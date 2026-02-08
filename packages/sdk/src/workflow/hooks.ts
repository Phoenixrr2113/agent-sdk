/**
 * @agent/sdk - Workflow Hooks & Human-in-the-Loop
 *
 * Provides typed suspension points for workflow execution.
 * When a hook fires, the workflow pauses (zero compute) and waits for
 * external input — typically a human approval via the `/hooks/:id/resume` endpoint.
 *
 * Features:
 * - `defineHook<TPayload, TResult>()` — Creates a typed hook factory
 * - `HookRegistry` — Tracks active, pending, and resolved hooks
 * - `createWebhook()` — Creates webhook-backed suspension points
 * - `sleep()` — Zero-compute durable delay wrapper
 * - Hook timeouts with configurable defaults
 *
 * @see SDK-HOOKS-008
 * @see https://useworkflow.dev
 */

import { createLogger } from '@agent/logger';
import { parseDuration } from './durable-agent';

const log = createLogger('@agent/sdk:workflow:hooks');

// ============================================================================
// Types
// ============================================================================

/** Status of a hook instance. */
export type HookStatus = 'pending' | 'resolved' | 'rejected' | 'timed_out';

/** Configuration for defining a hook factory. */
export interface HookDefinition<TPayload = unknown, TResult = unknown> {
  /** Human-readable name for this hook type. */
  name: string;

  /** Description of what this hook does / what the human should decide. */
  description?: string;

  /**
   * Timeout duration string (e.g., "30m", "1h").
   * After this time, the hook resolves with `defaultValue`.
   * If no timeout is specified, the hook waits indefinitely.
   */
  timeout?: string;

  /**
   * Default value returned when the hook times out.
   * Required if `timeout` is specified.
   */
  defaultValue?: TResult;

  /**
   * Optional validation function for the resume payload.
   * Throw to reject the resume attempt.
   */
  validate?: (payload: TResult) => void | Promise<void>;
}

/** A live hook instance that is waiting for resolution. */
export interface HookInstance<TPayload = unknown, TResult = unknown> {
  /** Unique ID for this hook instance. */
  id: string;

  /** Name from the hook definition. */
  name: string;

  /** Description from the hook definition. */
  description?: string;

  /** The payload passed when the hook was created (context for the human). */
  payload: TPayload;

  /** Current status. */
  status: HookStatus;

  /** When this hook was created. */
  createdAt: Date;

  /** When this hook was resolved/rejected/timed out (if applicable). */
  resolvedAt?: Date;

  /** Timeout in ms (undefined = no timeout). */
  timeoutMs?: number;

  /** The result value once resolved. */
  result?: TResult;
}

/** A typed hook factory returned by `defineHook()`. */
export interface Hook<TPayload = unknown, TResult = unknown> {
  /** The hook definition name. */
  readonly name: string;

  /** The hook definition description. */
  readonly description?: string;

  /**
   * Create a suspension point in the workflow.
   * Suspends execution and waits for external input via `/hooks/:id/resume`.
   *
   * @param payload - Context sent to the human (what they're approving/deciding)
   * @returns The result from the human (or default value on timeout)
   */
  wait: (payload: TPayload) => Promise<TResult>;

  /**
   * Create a suspension point with an explicit hook ID.
   * Useful for deterministic testing or resuming by known ID.
   */
  waitWithId: (id: string, payload: TPayload) => Promise<TResult>;
}

/** Options for creating a webhook suspension point. */
export interface WebhookOptions {
  /** Unique webhook ID. Auto-generated if not provided. */
  id?: string;

  /** URL path for the webhook callback (informational, not enforced). */
  callbackPath?: string;

  /** Timeout for the webhook response. */
  timeout?: string;

  /** Default value if webhook times out. */
  defaultValue?: unknown;
}

/** Result from a webhook suspension. */
export interface WebhookResult<T = unknown> {
  /** The payload received from the webhook callback. */
  data: T;

  /** Whether this was a timeout (data = defaultValue). */
  timedOut: boolean;
}

/** Options for the sleep() function. */
export interface SleepOptions {
  /** Reason for the sleep (logged for observability). */
  reason?: string;
}

// ============================================================================
// Hook Registry (Singleton)
// ============================================================================

/**
 * Registry that tracks all active hook instances.
 * The server's `/hooks/:id/resume` endpoint uses this to find and resolve hooks.
 *
 * Exported as a singleton. In production, this would be backed by
 * a durable store (e.g., workflow runtime state). For now, it's in-memory.
 */
export class HookRegistry {
  private hooks = new Map<string, HookInstance>();
  private resolvers = new Map<string, {
    resolve: (value: unknown) => void;
    reject: (reason: unknown) => void;
  }>();
  private validators = new Map<string, (payload: unknown) => void | Promise<void>>();
  private timeouts = new Map<string, ReturnType<typeof setTimeout>>();

  /** Get a hook instance by ID. */
  get(id: string): HookInstance | undefined {
    return this.hooks.get(id);
  }

  /** Check if a hook exists. */
  has(id: string): boolean {
    return this.hooks.has(id);
  }

  /** Get all hooks, optionally filtered by status. */
  list(status?: HookStatus): HookInstance[] {
    const all = Array.from(this.hooks.values());
    return status ? all.filter(h => h.status === status) : all;
  }

  /** Get all pending hooks. */
  listPending(): HookInstance[] {
    return this.list('pending');
  }

  /**
   * Register a new hook instance and return a promise that resolves
   * when the hook is resumed via `/hooks/:id/resume`.
   */
  register<TPayload, TResult>(
    id: string,
    name: string,
    payload: TPayload,
    options: {
      description?: string;
      timeoutMs?: number;
      defaultValue?: TResult;
      validate?: (payload: TResult) => void | Promise<void>;
    } = {},
  ): Promise<TResult> {
    if (this.hooks.has(id)) {
      throw new Error(`Hook with ID "${id}" already exists`);
    }

    const instance: HookInstance<TPayload, TResult> = {
      id,
      name,
      description: options.description,
      payload,
      status: 'pending',
      createdAt: new Date(),
      timeoutMs: options.timeoutMs,
    };

    this.hooks.set(id, instance as HookInstance);

    if (options.validate) {
      this.validators.set(id, options.validate as (p: unknown) => void | Promise<void>);
    }

    log.info('Hook registered', {
      hookId: id,
      name,
      timeoutMs: options.timeoutMs,
    });

    return new Promise<TResult>((resolve, reject) => {
      this.resolvers.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
      });

      // Set up timeout if configured
      if (options.timeoutMs && options.timeoutMs > 0) {
        const timer = setTimeout(() => {
          if (this.hooks.get(id)?.status === 'pending') {
            log.info('Hook timed out, using default value', { hookId: id, name });

            const hook = this.hooks.get(id)!;
            hook.status = 'timed_out';
            hook.resolvedAt = new Date();
            hook.result = options.defaultValue;

            this.resolvers.get(id)?.resolve(options.defaultValue);
            this.cleanup(id);
          }
        }, options.timeoutMs);

        this.timeouts.set(id, timer);
      }
    });
  }

  /**
   * Resume a suspended hook with a payload.
   * Called by the `/hooks/:id/resume` endpoint.
   *
   * @throws If hook not found, not pending, or validation fails
   */
  async resume(id: string, result: unknown): Promise<HookInstance> {
    const hook = this.hooks.get(id);
    if (!hook) {
      throw new HookNotFoundError(id);
    }

    if (hook.status !== 'pending') {
      throw new HookNotPendingError(id, hook.status);
    }

    // Run validation if defined
    const validator = this.validators.get(id);
    if (validator) {
      await validator(result);
    }

    hook.status = 'resolved';
    hook.resolvedAt = new Date();
    hook.result = result;

    log.info('Hook resumed', { hookId: id, name: hook.name });

    this.resolvers.get(id)?.resolve(result);
    this.cleanup(id);

    return hook;
  }

  /**
   * Reject a suspended hook with a reason.
   * Useful for cancellation flows.
   */
  reject(id: string, reason: string): HookInstance {
    const hook = this.hooks.get(id);
    if (!hook) {
      throw new HookNotFoundError(id);
    }

    if (hook.status !== 'pending') {
      throw new HookNotPendingError(id, hook.status);
    }

    hook.status = 'rejected';
    hook.resolvedAt = new Date();

    log.info('Hook rejected', { hookId: id, name: hook.name, reason });

    this.resolvers.get(id)?.reject(new HookRejectedError(id, reason));
    this.cleanup(id);

    return hook;
  }

  /** Clean up resolver and timeout for a hook. */
  private cleanup(id: string): void {
    this.resolvers.delete(id);
    this.validators.delete(id);
    const timer = this.timeouts.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timeouts.delete(id);
    }
  }

  /** Clear all hooks (for testing). */
  clear(): void {
    for (const timer of this.timeouts.values()) {
      clearTimeout(timer);
    }
    this.hooks.clear();
    this.resolvers.clear();
    this.validators.clear();
    this.timeouts.clear();
  }

  /** Number of registered hooks. */
  get size(): number {
    return this.hooks.size;
  }
}

// ============================================================================
// Error Classes
// ============================================================================

/** Thrown when a hook ID is not found in the registry. */
export class HookNotFoundError extends Error {
  readonly hookId: string;
  constructor(hookId: string) {
    super(`Hook "${hookId}" not found`);
    this.name = 'HookNotFoundError';
    this.hookId = hookId;
  }
}

/** Thrown when attempting to resume a hook that is not pending. */
export class HookNotPendingError extends Error {
  readonly hookId: string;
  readonly currentStatus: HookStatus;
  constructor(hookId: string, currentStatus: HookStatus) {
    super(`Hook "${hookId}" is not pending (status: ${currentStatus})`);
    this.name = 'HookNotPendingError';
    this.hookId = hookId;
    this.currentStatus = currentStatus;
  }
}

/** Thrown when a hook is rejected. */
export class HookRejectedError extends Error {
  readonly hookId: string;
  readonly reason: string;
  constructor(hookId: string, reason: string) {
    super(`Hook "${hookId}" was rejected: ${reason}`);
    this.name = 'HookRejectedError';
    this.hookId = hookId;
    this.reason = reason;
  }
}

// ============================================================================
// Singleton Registry
// ============================================================================

/** Global hook registry instance. */
let _registry: HookRegistry | null = null;

/** Get or create the global hook registry. */
export function getHookRegistry(): HookRegistry {
  if (!_registry) {
    _registry = new HookRegistry();
  }
  return _registry;
}

/**
 * Reset the global hook registry (for testing).
 * @internal
 */
export function _resetHookRegistry(): void {
  _registry?.clear();
  _registry = null;
}

// ============================================================================
// Hook Factory
// ============================================================================

let _hookCounter = 0;

/** Generate a unique hook instance ID. */
function generateHookId(name: string): string {
  _hookCounter++;
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `hook-${name}-${ts}-${rand}-${_hookCounter}`;
}

/**
 * Reset the hook counter (for testing).
 * @internal
 */
export function _resetHookCounter(): void {
  _hookCounter = 0;
}

/**
 * Define a typed hook factory.
 *
 * Creates a reusable hook definition that can produce suspension points
 * in workflow execution. Each call to `hook.wait()` creates a new
 * hook instance that pauses the workflow until resolved.
 *
 * @param definition - Hook configuration
 * @returns A typed hook factory
 *
 * @example
 * ```typescript
 * const approvalHook = defineHook<
 *   { action: string; details: string },
 *   { approved: boolean; reason?: string }
 * >({
 *   name: 'approval',
 *   description: 'Approve dangerous agent actions',
 *   timeout: '30m',
 *   defaultValue: { approved: false, reason: 'Timed out' },
 * });
 *
 * // In a workflow:
 * const result = await approvalHook.wait({
 *   action: 'delete files',
 *   details: '50 files will be removed',
 * });
 *
 * if (result.approved) {
 *   // proceed with deletion
 * }
 * ```
 */
export function defineHook<TPayload = unknown, TResult = unknown>(
  definition: HookDefinition<TPayload, TResult>,
): Hook<TPayload, TResult> {
  const { name, description, timeout, defaultValue, validate } = definition;

  const timeoutMs = timeout ? parseDuration(timeout) : undefined;

  if (timeout && defaultValue === undefined) {
    log.warn('Hook has timeout but no defaultValue — will resolve with undefined on timeout', { name });
  }

  log.debug('Hook defined', { name, description, timeoutMs });

  const wait = (payload: TPayload): Promise<TResult> => {
    const id = generateHookId(name);
    return waitWithId(id, payload);
  };

  const waitWithId = (id: string, payload: TPayload): Promise<TResult> => {
    log.info('Hook suspension created', { hookId: id, name, payload });

    const registry = getHookRegistry();
    return registry.register<TPayload, TResult>(id, name, payload, {
      description,
      timeoutMs,
      defaultValue,
      validate,
    });
  };

  return {
    name,
    description,
    wait,
    waitWithId,
  };
}

// ============================================================================
// Webhook Factory
// ============================================================================

/**
 * Create a webhook-backed suspension point.
 *
 * Similar to `defineHook`, but designed for external webhook integrations.
 * The webhook URL and callback path are informational — the actual resumption
 * happens via the `/hooks/:id/resume` endpoint.
 *
 * @param options - Webhook configuration
 * @returns Promise that resolves when the webhook fires
 *
 * @example
 * ```typescript
 * const result = await createWebhook<{ approved: boolean }>({
 *   callbackPath: '/api/approve',
 *   timeout: '1h',
 *   defaultValue: { approved: false },
 * });
 *
 * if (result.data.approved) {
 *   // proceed
 * }
 * ```
 */
export function createWebhook<T = unknown>(
  options: WebhookOptions = {},
): { id: string; promise: Promise<WebhookResult<T>> } {
  const id = options.id ?? generateHookId('webhook');
  const timeoutMs = options.timeout ? parseDuration(options.timeout) : undefined;

  log.info('Webhook created', {
    webhookId: id,
    callbackPath: options.callbackPath,
    timeoutMs,
  });

  const registry = getHookRegistry();

  const promise = registry.register<{ callbackPath?: string }, T>(
    id,
    'webhook',
    { callbackPath: options.callbackPath },
    {
      description: `Webhook callback: ${options.callbackPath ?? 'N/A'}`,
      timeoutMs,
      defaultValue: options.defaultValue as T,
    },
  ).then((data) => {
    const hook = registry.get(id);
    return {
      data,
      timedOut: hook?.status === 'timed_out',
    };
  });

  return { id, promise };
}

// ============================================================================
// Sleep (Durable Delay)
// ============================================================================

/**
 * Pause workflow execution with zero compute cost.
 *
 * Under the Workflow runtime, this uses durable sleep — the process is
 * suspended and resumed by the runtime after the delay. Without the
 * runtime, falls back to `setTimeout`.
 *
 * @param duration - Duration string (e.g., "30s", "5m", "1h")
 * @param options - Optional configuration
 *
 * @example
 * ```typescript
 * // Pause for 5 minutes (zero compute under workflow runtime)
 * await sleep('5m', { reason: 'Rate limit cooldown' });
 * ```
 */
export async function sleep(duration: string, options: SleepOptions = {}): Promise<void> {
  const ms = parseDuration(duration);

  log.info('Sleep started', {
    duration,
    ms,
    reason: options.reason,
  });

  try {
    // Try to use workflow runtime's durable sleep
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const workflowModule = await import('workflow').catch(() => null) as any;
    if (workflowModule?.sleep) {
      await workflowModule.sleep(ms);
      log.info('Workflow sleep completed', { duration });
      return;
    }
  } catch {
    // Fall through to setTimeout fallback
  }

  // Fallback: regular setTimeout
  log.debug('Using setTimeout fallback for sleep', { ms });
  await new Promise<void>((resolve) => setTimeout(resolve, ms));
  log.info('Sleep completed (setTimeout fallback)', { duration });
}

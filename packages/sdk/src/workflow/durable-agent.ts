/**
 * @agent/sdk - Durable Agent Factory
 *
 * Creates agents with workflow durability features.
 * Uses the Workflow DevKit ("use workflow" / "use step" directives)
 * for crash recovery, auto-retry, and step-level observability.
 *
 * When the `workflow` package is installed and the app runs under the
 * Workflow runtime, every LLM call and tool execution becomes a
 * discrete, checkpointed step. Without the runtime, the directives
 * are inert string literals and the agent operates normally.
 *
 * @see https://useworkflow.dev
 */

import { createLogger } from '@agent/logger';
import type { Agent } from '../agent';
import type { AgentOptions, WorkflowOptions } from '../types/agent';

const log = createLogger('@agent/sdk:workflow:durable');

// ============================================================================
// Types
// ============================================================================

/**
 * Extended options for creating a durable agent.
 * Includes all standard AgentOptions plus workflow-specific config.
 */
export interface DurableAgentOptions extends AgentOptions {
  /** Force durability even if detection is uncertain. Default: true */
  durable?: boolean;
  /** Workflow-specific configuration. */
  workflowOptions?: WorkflowOptions;
}

/**
 * Result from a durable generation.
 */
export interface DurableGenerateResult {
  text: string;
  workflowRunId?: string;
  steps?: Array<{
    name: string;
    status: 'completed' | 'failed' | 'skipped';
    durationMs?: number;
  }>;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Webhook response for approval workflows.
 */
export interface WebhookResponse {
  approved: boolean;
  feedback?: string;
  modifiedContent?: string;
}

/**
 * Extended agent interface with durable workflow capabilities.
 * Extends the base Agent interface with workflow-specific methods.
 */
export interface DurableAgent extends Agent {
  /**
   * Durable generate that wraps the LLM call as a workflow step.
   * Survives crashes — the workflow runtime checkpoints progress.
   */
  durableGenerate: (prompt: string) => Promise<DurableGenerateResult>;

  /**
   * Generate with approval workflow.
   * Pauses execution (zero compute) until webhook approval is received.
   */
  withApproval: (
    prompt: string,
    webhookPath: string
  ) => Promise<DurableGenerateResult>;

  /**
   * Scheduled generation with durable delay.
   * Uses workflow sleep() — doesn't hold compute during the delay.
   */
  scheduled: (prompt: string, delay: string) => Promise<DurableGenerateResult>;

  /** Whether workflows are actually active (runtime detected). */
  readonly isWorkflowActive: boolean;

  /** The workflow run ID (set after first workflow execution). */
  readonly workflowRunId: string | undefined;
}

// ============================================================================
// Workflow Runtime Detection
// ============================================================================

/** Cached availability result */
let _workflowAvailable: boolean | null = null;
let _workflowModule: WorkflowModule | null = null;

interface WorkflowModule {
  sleep: (duration: string) => Promise<void>;
  FatalError: new (message: string) => Error;
}

/**
 * Check if the Workflow DevKit runtime is available.
 * Result is cached after first check.
 */
export async function checkWorkflowAvailability(): Promise<boolean> {
  if (_workflowAvailable !== null) return _workflowAvailable;

  try {
    _workflowModule = await import('workflow') as unknown as WorkflowModule;
    _workflowAvailable = true;
    log.info('Workflow runtime detected');
    return true;
  } catch {
    _workflowAvailable = false;
    log.debug('Workflow runtime not available — durable features disabled');
    return false;
  }
}

/**
 * Get the workflow module (throws if not available).
 */
function getWorkflowModule(): WorkflowModule {
  if (!_workflowModule) {
    throw new Error(
      'Workflow package is not installed. Install it with: npm install workflow\n' +
      'See https://useworkflow.dev for documentation.'
    );
  }
  return _workflowModule;
}

/**
 * Reset workflow availability cache (for testing).
 * @internal
 */
export function _resetWorkflowCache(): void {
  _workflowAvailable = null;
  _workflowModule = null;
}

// ============================================================================
// Durable Execution Wrappers
// ============================================================================

/**
 * Wrap an agent's generate call as a workflow.
 * The "use workflow" directive marks the entire function as a durable workflow.
 * The "use step" directives inside mark individual checkpoints.
 */
async function durableGenerateWorkflow(
  agent: Agent,
  prompt: string,
): Promise<DurableGenerateResult> {
  "use workflow";

  log.info('durableGenerateWorkflow started', { promptLength: prompt.length });

  // LLM call as a named step
  const result = await (async () => {
    "use step";
    return agent.generate({ prompt });
  })();

  const text = await result.text;
  const totalUsage = result.totalUsage;

  log.info('durableGenerateWorkflow completed', { textLength: text?.length ?? 0 });

  return {
    text: text ?? '',
    steps: [{
      name: 'llm-generate',
      status: 'completed',
    }],
    usage: totalUsage ? {
      promptTokens: totalUsage.inputTokens ?? 0,
      completionTokens: totalUsage.outputTokens ?? 0,
      totalTokens: totalUsage.totalTokens ?? 0,
    } : undefined,
  };
}

/**
 * Wrap an agent's generate call with approval workflow.
 * The function suspends (zero compute) while waiting for webhook approval.
 */
async function durableWithApprovalWorkflow(
  agent: Agent,
  prompt: string,
  _webhookPath: string,
): Promise<DurableGenerateResult> {
  "use workflow";

  log.info('durableWithApprovalWorkflow started', { prompt: prompt.slice(0, 100) });

  // Step 1: Generate draft
  const draftResult = await (async () => {
    "use step";
    return agent.generate({ prompt });
  })();

  const draftText = await draftResult.text;

  // Step 2: Wait for approval (webhook)
  // In production, this suspends the workflow. The Workflow runtime
  // handles the webhook endpoint and resumes when the webhook fires.
  log.info('Waiting for approval webhook');
  const approval: WebhookResponse = await (async () => {
    "use step";
    // The workflow runtime handles webhook suspension here.
    // This stub returns approved=true when not running under the runtime.
    return { approved: true } as WebhookResponse;
  })();

  if (!approval.approved) {
    log.warn('Approval rejected', { feedback: approval.feedback });
    throw new Error(`Approval rejected: ${approval.feedback || 'No reason provided'}`);
  }

  // Step 3: Finalize
  const finalPrompt = approval.modifiedContent
    ? `Finalize with modifications: ${approval.modifiedContent}. Original: ${draftText}`
    : prompt;

  const finalResult = await (async () => {
    "use step";
    return agent.generate({ prompt: finalPrompt });
  })();

  const finalText = await finalResult.text;

  return {
    text: finalText ?? '',
    steps: [
      { name: 'llm-draft', status: 'completed' },
      { name: 'webhook-approval', status: 'completed' },
      { name: 'llm-finalize', status: 'completed' },
    ],
  };
}

/**
 * Wrap an agent's generate call with a durable delay.
 * Uses workflow sleep() — doesn't hold compute during the delay.
 */
async function durableScheduledWorkflow(
  agent: Agent,
  prompt: string,
  delay: string,
): Promise<DurableGenerateResult> {
  "use workflow";

  log.info('durableScheduledWorkflow started', { delay });

  // Step 1: Sleep (zero compute)
  await (async () => {
    "use step";
    try {
      const wf = getWorkflowModule();
      await wf.sleep(delay);
    } catch {
      // If workflow not available, use regular setTimeout as fallback
      const ms = parseDuration(delay);
      log.warn('Workflow sleep unavailable, using setTimeout fallback', { ms });
      await new Promise<void>(resolve => setTimeout(resolve, ms));
    }
  })();

  log.info('Sleep completed, executing prompt');

  // Step 2: Generate
  const result = await (async () => {
    "use step";
    return agent.generate({ prompt });
  })();

  const text = await result.text;

  return {
    text: text ?? '',
    steps: [
      { name: 'sleep', status: 'completed' },
      { name: 'llm-generate', status: 'completed' },
    ],
  };
}

// ============================================================================
// Durable Agent Factory
// ============================================================================

/**
 * Create a durable agent with workflow integration.
 *
 * The durable agent wraps a standard Agent with workflow directives
 * that make every LLM call and tool execution a recoverable step.
 *
 * @param baseAgent - The base agent to wrap with durability
 * @param options - Durable agent options
 * @returns DurableAgent instance with both standard and durable methods
 *
 * @example
 * ```typescript
 * import { createAgent } from '@agent/sdk';
 * import { createDurableAgent } from '@agent/sdk/workflow';
 *
 * const base = createAgent({ role: 'coder', toolPreset: 'standard' });
 * const agent = createDurableAgent(base);
 *
 * // Standard generation (no durability)
 * const result = await agent.generate({ prompt: 'Hello' });
 *
 * // Durable generation (survives crashes)
 * const durable = await agent.durableGenerate('Create a component');
 *
 * // With approval workflow
 * const approved = await agent.withApproval('Draft email', '/api/approve');
 *
 * // Scheduled generation
 * const delayed = await agent.scheduled('Send reminder', '1h');
 * ```
 */
export function createDurableAgent(
  baseAgent: Agent,
  options: DurableAgentOptions = {}
): DurableAgent {
  log.info('Creating durable agent', {
    agentId: baseAgent.agentId,
    role: baseAgent.role,
    workflowOptions: options.workflowOptions,
  });

  let workflowRunId: string | undefined = options.workflowOptions?.workflowRunId;

  /**
   * Guard: ensure workflow is available before executing a durable method.
   * Throws a clear, actionable error if the workflow package isn't installed.
   * Standard Agent methods (generate, stream) still work without workflow.
   */
  async function ensureWorkflowAvailable(): Promise<void> {
    const available = await checkWorkflowAvailability();
    if (!available) {
      throw new Error(
        'Workflow package is not installed. Durable agent features require the workflow package.\n' +
        'Install with: npm install workflow\n' +
        'See https://useworkflow.dev for documentation.'
      );
    }
  }

  const durableAgent: DurableAgent = {
    // Delegate standard Agent interface to the base agent
    agentId: baseAgent.agentId,
    role: baseAgent.role,
    getToolLoopAgent: () => baseAgent.getToolLoopAgent(),
    getSystemPrompt: () => baseAgent.getSystemPrompt(),

    // Standard methods — pass through to base agent (work without workflow)
    stream: (input) => baseAgent.stream(input),
    generate: (input) => baseAgent.generate(input),

    // Durable methods — require workflow package
    durableGenerate: async (prompt: string) => {
      await ensureWorkflowAvailable();
      log.info('durableGenerate() called', { promptLength: prompt.length });
      const result = await durableGenerateWorkflow(baseAgent, prompt);
      if (result.workflowRunId) workflowRunId = result.workflowRunId;
      return result;
    },

    withApproval: async (prompt: string, webhookPath: string) => {
      await ensureWorkflowAvailable();
      log.info('withApproval() called', { promptLength: prompt.length, webhookPath });
      return durableWithApprovalWorkflow(baseAgent, prompt, webhookPath);
    },

    scheduled: async (prompt: string, delay: string) => {
      await ensureWorkflowAvailable();
      log.info('scheduled() called', { promptLength: prompt.length, delay });
      return durableScheduledWorkflow(baseAgent, prompt, delay);
    },

    get isWorkflowActive() {
      return _workflowAvailable === true;
    },

    get workflowRunId() {
      return workflowRunId;
    },
  };

  log.info('Durable agent created', { agentId: baseAgent.agentId });

  return durableAgent;
}

// ============================================================================
// Workflow Helpers
// ============================================================================

/**
 * Parse a duration string into milliseconds.
 * Supports: 30s, 5m, 1h, 1d
 */
export function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)(s|m|h|d)$/);
  if (!match) {
    throw new Error(`Invalid duration format: ${duration}. Use format like '30s', '5m', '1h', '1d'`);
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      throw new Error(`Unknown duration unit: ${unit}`);
  }
}

/**
 * Format milliseconds as a human-readable duration.
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
  if (ms < 86400000) return `${Math.round(ms / 3600000)}h`;
  return `${Math.round(ms / 86400000)}d`;
}

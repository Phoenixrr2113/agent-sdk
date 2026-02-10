/**
 * @fileoverview Type definitions for the guardrails system.
 */

/**
 * Result of a guardrail check.
 */
export interface GuardrailResult {
  /** Whether the content passed the guardrail. */
  passed: boolean;
  /** Name of the guardrail that produced this result. */
  name: string;
  /** Human-readable message (populated on failure). */
  message?: string;
  /** Filtered/cleaned output (if the guardrail supports filtering). */
  filtered?: string;
}

/**
 * A guardrail function that validates content.
 * Receives the text to validate and returns a result.
 * Can be async for guardrails that call external services.
 */
export interface Guardrail {
  /** Unique name for this guardrail. */
  name: string;
  /** Check function. Returns result or throws on unexpected errors. */
  check: (text: string, context?: GuardrailContext) => GuardrailResult | Promise<GuardrailResult>;
}

/**
 * Context passed to guardrails for richer decision-making.
 */
export interface GuardrailContext {
  /** The original user prompt. */
  prompt?: string;
  /** Whether this is an input or output guardrail. */
  phase: 'input' | 'output';
}

/**
 * Action to take when a guardrail blocks.
 */
export type OnBlockAction = 'throw' | 'retry' | 'filter';

/**
 * Configuration for guardrails on an agent.
 */
export interface GuardrailsConfig {
  /** Guardrails to run on user input (before the agent). */
  input?: Guardrail[];
  /** Guardrails to run on agent output (after the agent). */
  output?: Guardrail[];
  /** Action when a guardrail blocks. Default: 'throw'. */
  onBlock?: OnBlockAction;
  /** Maximum retries when onBlock is 'retry'. Default: 2. */
  maxRetries?: number;
}

/**
 * Error thrown when a guardrail blocks and onBlock is 'throw'.
 */
export class GuardrailBlockedError extends Error {
  public readonly guardrailName: string;
  public readonly phase: 'input' | 'output';
  public readonly results: GuardrailResult[];

  constructor(phase: 'input' | 'output', results: GuardrailResult[]) {
    const failed = results.filter((r) => !r.passed);
    const names = failed.map((r) => r.name).join(', ');
    const messages = failed.map((r) => r.message).filter(Boolean).join('; ');
    super(`Guardrail blocked (${phase}): [${names}] ${messages}`);
    this.name = 'GuardrailBlockedError';
    this.guardrailName = names;
    this.phase = phase;
    this.results = results;
  }
}

/**
 * @agntk/core - Usage Limits
 *
 * Token and request caps for agents. Prevents runaway loops from
 * burning API budget by enforcing maxRequests, maxInputTokens,
 * maxOutputTokens, and maxTotalTokens.
 */

import type { ToolSet, StepResult } from 'ai';

// ============================================================================
// Types
// ============================================================================

/** Usage limits for an agent run. All fields are optional — only set limits are enforced. */
export interface UsageLimits {
  /** Maximum number of LLM round-trips (steps). */
  maxRequests?: number;
  /** Maximum cumulative input tokens across all steps. */
  maxInputTokens?: number;
  /** Maximum cumulative output tokens across all steps. */
  maxOutputTokens?: number;
  /** Maximum cumulative total tokens (input + output) across all steps. */
  maxTotalTokens?: number;
}

/** Which limit was exceeded. */
export type UsageLimitType = 'maxRequests' | 'maxInputTokens' | 'maxOutputTokens' | 'maxTotalTokens';

/** Current usage snapshot at the time a limit was exceeded. */
export interface UsageSnapshot {
  requests: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

// ============================================================================
// Error
// ============================================================================

/**
 * Thrown when an agent exceeds a configured usage limit.
 *
 * @example
 * ```typescript
 * try {
 *   const result = await agent.stream({ prompt: 'do something' });
 * } catch (error) {
 *   if (error instanceof UsageLimitExceeded) {
 *     console.log(`Hit ${error.limitType}: ${error.currentValue}/${error.limitValue}`);
 *   }
 * }
 * ```
 */
export class UsageLimitExceeded extends Error {
  override readonly name = 'UsageLimitExceeded';
  readonly limitType: UsageLimitType;
  readonly limitValue: number;
  readonly currentValue: number;
  readonly usage: UsageSnapshot;

  constructor(
    limitType: UsageLimitType,
    limitValue: number,
    currentValue: number,
    usage: UsageSnapshot,
  ) {
    super(
      `Usage limit exceeded: ${limitType} = ${currentValue} (limit: ${limitValue})`,
    );
    this.limitType = limitType;
    this.limitValue = limitValue;
    this.currentValue = currentValue;
    this.usage = usage;
  }
}

// ============================================================================
// Stop Condition Factory
// ============================================================================

/**
 * Create a StopCondition that checks usage limits after each step.
 *
 * Compatible with AI SDK's `stopWhen` array — combine with `stepCountIs()`.
 *
 * When a limit is exceeded, the condition throws `UsageLimitExceeded`
 * rather than returning `true`, because returning `true` would silently
 * stop the agent. Throwing gives the caller a clear signal with details.
 */
export function usageLimitStop<TOOLS extends ToolSet>(
  limits: UsageLimits,
): (options: { steps: Array<StepResult<TOOLS>> }) => boolean {
  return ({ steps }) => {
    const usage = computeUsage(steps);

    if (limits.maxRequests !== undefined && usage.requests > limits.maxRequests) {
      throw new UsageLimitExceeded('maxRequests', limits.maxRequests, usage.requests, usage);
    }

    if (limits.maxInputTokens !== undefined && usage.inputTokens > limits.maxInputTokens) {
      throw new UsageLimitExceeded('maxInputTokens', limits.maxInputTokens, usage.inputTokens, usage);
    }

    if (limits.maxOutputTokens !== undefined && usage.outputTokens > limits.maxOutputTokens) {
      throw new UsageLimitExceeded('maxOutputTokens', limits.maxOutputTokens, usage.outputTokens, usage);
    }

    if (limits.maxTotalTokens !== undefined && usage.totalTokens > limits.maxTotalTokens) {
      throw new UsageLimitExceeded('maxTotalTokens', limits.maxTotalTokens, usage.totalTokens, usage);
    }

    return false; // Don't stop — limits not reached
  };
}

// ============================================================================
// Helpers
// ============================================================================

function computeUsage<TOOLS extends ToolSet>(steps: Array<StepResult<TOOLS>>): UsageSnapshot {
  let inputTokens = 0;
  let outputTokens = 0;
  let totalTokens = 0;

  for (const step of steps) {
    inputTokens += step.usage?.inputTokens ?? 0;
    outputTokens += step.usage?.outputTokens ?? 0;
    totalTokens += step.usage?.totalTokens ?? 0;
  }

  return {
    requests: steps.length,
    inputTokens,
    outputTokens,
    totalTokens,
  };
}

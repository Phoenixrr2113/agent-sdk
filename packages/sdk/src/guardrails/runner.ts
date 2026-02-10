/**
 * @fileoverview Guardrail runner with parallel execution and fast-fail.
 */

import { createLogger } from '@agent/logger';
import type {
  Guardrail,
  GuardrailResult,
  GuardrailContext,
  GuardrailsConfig,
  OnBlockAction,
} from './types';
import { GuardrailBlockedError } from './types';

const log = createLogger('@agent/sdk:guardrails');

// ============================================================================
// Parallel Runner
// ============================================================================

/**
 * Run guardrails in parallel with fast-fail.
 * All guardrails start concurrently. Returns as soon as all complete.
 * If any guardrail fails, all results are still collected.
 */
export async function runGuardrails(
  guardrails: Guardrail[],
  text: string,
  context: GuardrailContext,
): Promise<GuardrailResult[]> {
  if (guardrails.length === 0) return [];

  const results = await Promise.all(
    guardrails.map(async (guard) => {
      try {
        return await guard.check(text, context);
      } catch (error) {
        log.error('Guardrail threw', { name: guard.name, error: String(error) });
        return {
          passed: false,
          name: guard.name,
          message: `Guardrail error: ${error instanceof Error ? error.message : String(error)}`,
        } satisfies GuardrailResult;
      }
    }),
  );

  return results;
}

/**
 * Check guardrail results and handle the onBlock action.
 *
 * @returns The (possibly filtered) text, or throws if blocked.
 */
export function handleGuardrailResults(
  results: GuardrailResult[],
  text: string,
  phase: 'input' | 'output',
  onBlock: OnBlockAction,
): { blocked: boolean; text: string; results: GuardrailResult[] } {
  const allPassed = results.every((r) => r.passed);

  if (allPassed) {
    return { blocked: false, text, results };
  }

  log.info('Guardrail blocked', {
    phase,
    onBlock,
    failed: results.filter((r) => !r.passed).map((r) => r.name),
  });

  switch (onBlock) {
    case 'throw':
      throw new GuardrailBlockedError(phase, results);

    case 'filter': {
      // Apply filtered versions from guardrails that support it
      let filteredText = text;
      for (const r of results) {
        if (!r.passed && r.filtered) {
          filteredText = r.filtered;
        }
      }
      return { blocked: true, text: filteredText, results };
    }

    case 'retry':
      // Signal that a retry is needed — caller handles the retry loop
      return { blocked: true, text, results };

    default:
      throw new GuardrailBlockedError(phase, results);
  }
}

// ============================================================================
// Agent Wrapper
// ============================================================================

/**
 * Build a guardrail feedback message for retry attempts.
 * This is appended to the prompt when retrying after an output guardrail failure.
 */
export function buildRetryFeedback(results: GuardrailResult[]): string {
  const failed = results.filter((r) => !r.passed);
  const lines = failed.map((r) => `- [${r.name}]: ${r.message ?? 'blocked'}`);
  return (
    '\n\n[GUARDRAIL FEEDBACK] Your previous response was blocked. Please regenerate, addressing:\n' +
    lines.join('\n')
  );
}

/**
 * Wrap an agent's generate function with guardrail checks.
 *
 * Input guardrails run before the agent; output guardrails run after.
 * Both phases run their guardrails in parallel.
 */
export function wrapWithGuardrails<T extends { text: string }>(
  generateFn: (input: { prompt: string }) => Promise<T>,
  config: GuardrailsConfig,
): (input: { prompt: string }) => Promise<T> {
  const { input: inputGuards = [], output: outputGuards = [], onBlock = 'throw', maxRetries = 2 } = config;

  return async (input: { prompt: string }) => {
    // ─── Input Guardrails ───────────────────────────────────────────────
    if (inputGuards.length > 0) {
      const inputResults = await runGuardrails(inputGuards, input.prompt, {
        prompt: input.prompt,
        phase: 'input',
      });

      const inputCheck = handleGuardrailResults(inputResults, input.prompt, 'input', onBlock);
      if (inputCheck.blocked && onBlock === 'filter') {
        input = { prompt: inputCheck.text };
      }
      // If onBlock is 'retry' for input, we just throw (can't retry user input)
      if (inputCheck.blocked && onBlock === 'retry') {
        throw new GuardrailBlockedError('input', inputResults);
      }
    }

    // ─── Agent Execution + Output Guardrails ────────────────────────────
    let lastResult: T | undefined;
    let attempts = 0;
    let currentPrompt = input.prompt;

    while (attempts <= maxRetries) {
      lastResult = await generateFn({ prompt: currentPrompt });

      if (outputGuards.length === 0) {
        return lastResult;
      }

      const outputResults = await runGuardrails(outputGuards, lastResult.text, {
        prompt: input.prompt,
        phase: 'output',
      });

      const outputCheck = handleGuardrailResults(
        outputResults,
        lastResult.text,
        'output',
        onBlock,
      );

      if (!outputCheck.blocked) {
        return lastResult;
      }

      if (onBlock === 'filter') {
        return { ...lastResult, text: outputCheck.text };
      }

      if (onBlock === 'retry') {
        attempts++;
        if (attempts > maxRetries) {
          throw new GuardrailBlockedError('output', outputResults);
        }
        // Append guardrail feedback for the retry
        currentPrompt = input.prompt + buildRetryFeedback(outputResults);
        log.info('Retrying with guardrail feedback', { attempt: attempts, maxRetries });
        continue;
      }

      // onBlock === 'throw' is handled inside handleGuardrailResults
      break;
    }

    return lastResult!;
  };
}

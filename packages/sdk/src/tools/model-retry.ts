/**
 * @agntk/core - Model Retry
 *
 * Error class and tool wrapper for LLM-retryable tool errors.
 * When a tool throws ModelRetry, the error message is fed back to
 * the model as corrective instructions, allowing it to retry with
 * better parameters.
 */

import { createLogger } from '@agntk/logger';

const log = createLogger('@agntk/core:model-retry');

// ============================================================================
// ModelRetry Error
// ============================================================================

/**
 * Throw this error from a tool execute function to instruct the LLM
 * to retry with corrective guidance.
 *
 * @example
 * ```typescript
 * execute: async ({ query }) => {
 *   if (query.length < 3) {
 *     throw new ModelRetry('Query too short. Provide at least 3 characters.');
 *   }
 *   // ...
 * }
 * ```
 */
export class ModelRetry extends Error {
  override readonly name = 'ModelRetry';

  constructor(message: string) {
    super(message);
  }
}

// ============================================================================
// wrapToolWithRetry
// ============================================================================

const DEFAULT_MAX_RETRIES = 3;

interface ToolLike {
  description?: string;
  inputSchema?: unknown;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  execute?: Function;
  [key: string]: unknown;
}

/**
 * Wraps a tool's execute function to catch ModelRetry errors and
 * return corrective instructions to the model instead of failing.
 *
 * After maxRetries consecutive ModelRetry errors, the last error
 * message is returned as a final failure.
 *
 * @param tool - An AI SDK tool definition
 * @param maxRetries - Maximum retries per invocation (default: 3)
 * @returns A new tool with retry-aware execution
 */
export function wrapToolWithRetry<T extends ToolLike>(
  toolDef: T,
  maxRetries: number = DEFAULT_MAX_RETRIES,
): T {
  const originalExecute = toolDef.execute;
  if (!originalExecute) return toolDef;

  let retryCount = 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wrappedExecute = async (...args: any[]): Promise<unknown> => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      const result = await (originalExecute as (...a: unknown[]) => Promise<unknown>)(...args);
      retryCount = 0; // Reset on success
      return result;
    } catch (err) {
      if (err instanceof ModelRetry) {
        retryCount++;
        log.info('ModelRetry caught', {
          message: err.message,
          retryCount,
          maxRetries,
        });

        if (retryCount > maxRetries) {
          retryCount = 0;
          return JSON.stringify({
            success: false,
            error: `Tool failed after ${String(maxRetries)} retries: ${err.message}`,
            retryExhausted: true,
          });
        }

        // Return corrective instructions to the model
        return JSON.stringify({
          success: false,
          error: err.message,
          retryable: true,
          retriesRemaining: maxRetries - retryCount,
          instruction: `Please retry with corrected parameters. ${err.message}`,
        });
      }

      // Non-retryable errors pass through
      throw err;
    }
  };

  return {
    ...toolDef,
    execute: wrappedExecute,
  } as T;
}

/**
 * Wrap all tools in a tool set with retry handling.
 *
 * @param tools - Record of tool name to tool definition
 * @param maxRetries - Maximum retries per tool per invocation
 * @returns New tools record with retry-aware execution
 */
export function wrapAllToolsWithRetry<T extends Record<string, ToolLike>>(
  tools: T,
  maxRetries: number = DEFAULT_MAX_RETRIES,
): T {
  const wrapped: Record<string, ToolLike> = {};

  for (const [name, toolDef] of Object.entries(tools)) {
    wrapped[name] = wrapToolWithRetry(toolDef, maxRetries);
  }

  return wrapped as T;
}

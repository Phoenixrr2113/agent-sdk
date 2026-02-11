/**
 * @agntk/core - Durable Tool Wrapper
 *
 * Wraps tools with durability directives for crash recovery.
 * Uses the Workflow DevKit's "use step" directive to checkpoint tool executions.
 * Each tool step gets a descriptive name for observability in the workflow inspector.
 *
 * @see https://useworkflow.dev
 */

import type { Tool } from 'ai';
import { createLogger } from '@agntk/logger';

const log = createLogger('@agntk/core:workflow:tool');

// ============================================================================
// Types
// ============================================================================

type ToolSet = Record<string, Tool>;

export interface DurabilityConfig {
  /** Enable durability for this tool. Default: true */
  enabled?: boolean;
  /** Whether this tool can run independently in parallel. Default: false */
  independent?: boolean;
  /** Number of retry attempts on failure. Default: 3 */
  retryCount?: number;
  /** Timeout duration string (e.g., "30s", "5m"). Default: "5m" */
  timeout?: string;
  /** Custom step name for the workflow inspector. Default: "tool-exec-{toolName}" */
  stepName?: string;
}

// ============================================================================
// Single Tool Wrapper
// ============================================================================

/**
 * Wrap a single tool with durability directives.
 *
 * When wrapped, the tool's execute function uses the "use step" directive
 * to create a checkpoint. If the process crashes, the workflow runtime
 * resumes from the last checkpoint.
 *
 * Each wrapped tool gets a descriptive step name for the workflow inspector:
 * - Default: "tool-exec-{toolName}"
 * - Custom via `config.stepName`
 *
 * @param tool - The tool to wrap
 * @param config - Durability configuration
 * @param toolName - Name of the tool (used for step naming)
 * @returns Wrapped tool with durability enabled
 *
 * @example
 * ```typescript
 * const durableReadFile = wrapToolAsDurableStep(readFileTool, {
 *   retryCount: 3,
 *   timeout: '30s',
 * }, 'read_file');
 * ```
 */
export function wrapToolAsDurableStep(
  tool: Tool,
  config: DurabilityConfig = {},
  toolName?: string
): Tool {
  const { enabled = true } = config;

  if (!enabled) {
    return tool;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const originalExecute = (tool as any).execute;
  if (!originalExecute) {
    return tool;
  }

  const stepName = config.stepName ?? (toolName ? `tool-exec-${toolName}` : 'tool-exec');

  const wrappedTool = {
    ...tool,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    execute: async (input: any, options: any) => {
      // The "use step" directive tells the workflow runtime to checkpoint here.
      // When the workflow resumes after a crash, it skips to this point
      // and returns the cached result instead of re-executing.
      "use step";

      log.debug(`Executing durable step: ${stepName}`, {
        stepName,
        retryCount: config.retryCount,
        timeout: config.timeout,
      });

      try {
        const result = await originalExecute(input, options);
        log.debug(`Durable step completed: ${stepName}`);
        return result;
      } catch (error) {
        log.error(`Durable step failed: ${stepName}`, {
          error: error instanceof Error ? error.message : String(error),
        });
        // Re-throw to let the workflow runtime handle retries
        throw error;
      }
    },
  } as Tool;

  // Store step name and config as metadata
  setDurabilityConfig(wrappedTool, { ...config, stepName });

  return wrappedTool;
}

// ============================================================================
// Batch Tool Wrapper
// ============================================================================

/**
 * Wrap all tools in a set with durability directives.
 * Each tool gets a step name based on its key in the record.
 *
 * @param tools - Record of tools to wrap
 * @param config - Durability configuration applied to all tools
 * @returns Record of wrapped tools
 *
 * @example
 * ```typescript
 * const durableTools = wrapToolsAsDurable(myTools, {
 *   retryCount: 3,
 *   timeout: '5m',
 * });
 * ```
 */
export function wrapToolsAsDurable(
  tools: ToolSet,
  config: DurabilityConfig = {}
): ToolSet {
  log.debug('Wrapping all tools as durable', { count: Object.keys(tools).length });

  return Object.fromEntries(
    Object.entries(tools).map(([name, tool]) => [
      name,
      wrapToolAsDurableStep(tool, config, name),
    ])
  );
}

// ============================================================================
// Selective Wrapping
// ============================================================================

/**
 * Wrap only specified tools with durability, leaving others unchanged.
 *
 * @param tools - All tools
 * @param toolNames - Names of tools to wrap
 * @param config - Durability configuration
 * @returns Tools with selective durability applied
 */
export function wrapSelectedToolsAsDurable(
  tools: ToolSet,
  toolNames: string[],
  config: DurabilityConfig = {}
): ToolSet {
  const nameSet = new Set(toolNames);
  log.debug('Selectively wrapping tools as durable', {
    total: Object.keys(tools).length,
    selected: toolNames,
  });

  return Object.fromEntries(
    Object.entries(tools).map(([name, tool]) => [
      name,
      nameSet.has(name) ? wrapToolAsDurableStep(tool, config, name) : tool,
    ])
  );
}

// ============================================================================
// Independent Step Wrapper
// ============================================================================

/**
 * Wrap a tool as an independent durable step.
 *
 * Independent steps can be executed in parallel with other independent steps.
 * The workflow runtime optimizes by running these concurrently.
 *
 * @param tool - The tool to wrap
 * @param toolName - Name of the tool (used for step naming)
 * @returns Wrapped tool marked as independent
 */
export function wrapToolAsIndependentStep(tool: Tool, toolName?: string): Tool {
  return wrapToolAsDurableStep(tool, { independent: true }, toolName);
}

// ============================================================================
// Durability Metadata
// ============================================================================

/**
 * Symbol for storing durability metadata on tools.
 */
export const DURABILITY_CONFIG = Symbol('durabilityConfig');

/**
 * Get durability configuration from a tool (if set).
 */
export function getDurabilityConfig(tool: Tool): DurabilityConfig | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (tool as any)[DURABILITY_CONFIG];
}

/**
 * Set durability configuration on a tool.
 */
export function setDurabilityConfig(tool: Tool, config: DurabilityConfig): Tool {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (tool as any)[DURABILITY_CONFIG] = config;
  return tool;
}

/**
 * Get the step name assigned to a durable tool.
 */
export function getStepName(tool: Tool): string | undefined {
  return getDurabilityConfig(tool)?.stepName;
}

/**
 * @agent/sdk - Tool Approval System
 *
 * Wraps tools with AI SDK's native `needsApproval` flag for human-in-the-loop
 * safety. When `approval: true` is set on the agent, dangerous tools
 * (shell, browser, file_write, file_edit) automatically require approval.
 *
 * Supports:
 * - Auto-flagging dangerous tools
 * - Typed approval payloads via Zod schemas
 * - Timeout with default values (approve/deny after N ms)
 * - Custom approval handlers
 */

import type { Tool, ToolSet } from 'ai';
import { createLogger } from '@agent/logger';

const log = createLogger('@agent/sdk:approval');

// ============================================================================
// Types
// ============================================================================

/** Configuration for the approval system. */
export interface ApprovalConfig {
  /** Enable approval for dangerous tools. Default: false */
  enabled: boolean;

  /** Tool names that require approval. If not set, uses DANGEROUS_TOOLS. */
  tools?: string[];

  /** Default timeout in ms before auto-resolution. Default: none (wait forever) */
  timeout?: number;

  /** Default action when timeout expires. Default: 'deny' */
  timeoutAction?: 'approve' | 'deny';

  /** Custom handler called when a tool needs approval.
   * Return true to approve, false to deny.
   * If not provided, uses the AI SDK's built-in approval mechanism. */
  handler?: ApprovalHandler;
}

/** Custom approval handler function. */
export type ApprovalHandler = (request: ApprovalRequest) => Promise<boolean> | boolean;

/** Details about a tool call requiring approval. */
export interface ApprovalRequest {
  toolName: string;
  input: unknown;
  toolCallId: string;
}

// ============================================================================
// Constants
// ============================================================================

/** Default set of tool names considered dangerous and requiring approval. */
export const DANGEROUS_TOOLS = new Set([
  'shell',
  'browser',
  'file_write',
  'file_edit',
  'file_create',
]);

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Check if a tool name is considered dangerous.
 */
export function isDangerousTool(toolName: string, customList?: string[]): boolean {
  if (customList) {
    return customList.includes(toolName);
  }
  return DANGEROUS_TOOLS.has(toolName);
}

/**
 * Wrap a single tool with `needsApproval`, applying timeout + default action
 * if configured.
 */
export function wrapToolWithApproval<T extends Tool>(
  toolName: string,
  tool: T,
  config: ApprovalConfig,
): T {
  const { handler, timeout, timeoutAction = 'deny' } = config;

  if (handler) {
    // Use a custom handler via needsApproval function
    const wrappedTool = {
      ...tool,
      needsApproval: async (input: unknown) => {
        const request: ApprovalRequest = {
          toolName,
          input,
          toolCallId: `approval-${Date.now()}`,
        };

        if (timeout) {
          // Race handler against timeout
          const result = await Promise.race([
            handler(request),
            new Promise<boolean>((resolve) =>
              setTimeout(() => {
                log.warn('Approval timed out', { toolName, timeout, action: timeoutAction });
                resolve(timeoutAction === 'approve');
              }, timeout),
            ),
          ]);
          return result;
        }

        return handler(request);
      },
    };
    return wrappedTool as T;
  }

  // Use simple boolean flag — the AI SDK will handle the approval UI
  return { ...tool, needsApproval: true } as T;
}

/**
 * Apply approval to all dangerous tools in a toolset.
 *
 * @example
 * ```typescript
 * const tools = createToolPreset('standard', { workspaceRoot });
 * const approvedTools = applyApproval(tools, { enabled: true });
 * ```
 */
export function applyApproval(
  tools: ToolSet,
  config: ApprovalConfig,
): ToolSet {
  if (!config.enabled) return tools;

  const result: ToolSet = {};
  const dangerousList = config.tools;

  for (const [name, tool] of Object.entries(tools)) {
    if (isDangerousTool(name, dangerousList)) {
      log.debug('Applying approval to tool', { tool: name });
      result[name] = wrapToolWithApproval(name, tool, config);
    } else {
      result[name] = tool;
    }
  }

  return result;
}

/**
 * Create an approval config from agent options shorthand.
 *
 * Supports:
 * - `approval: true` → enable with defaults
 * - `approval: { tools: [...], timeout: 30000 }` → custom config
 */
export function resolveApprovalConfig(
  input: boolean | ApprovalConfig | undefined,
): ApprovalConfig | undefined {
  if (!input) return undefined;
  if (input === true) return { enabled: true };
  return input;
}

/**
 * @fileoverview V2 Agent types — minimal, zero-config interface.
 *
 * An agent is a fully-equipped worker. You give it a name, instructions,
 * and a prompt. Everything else is auto-detected.
 */

import type { LanguageModel, LanguageModelUsage } from 'ai';
import type { UsageLimits } from '../usage-limits';

// ═══════════════════════════════════════════════════════════════════════════════
// AgentOptions V2
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Configuration for creating a v2 agent.
 *
 * Only `name` is required. Everything else has sensible defaults or
 * is auto-detected from the environment.
 */
export interface AgentOptionsV2 {
  /**
   * Display name for this agent.
   * Used in logs, traces, multi-agent coordination, and persistent state.
   * Persistent agent state is stored at `~/.agntk/agents/{name}/`.
   */
  name: string;

  /**
   * What this agent does. Natural language context injected as the system prompt.
   * This is NOT a role — it's the agent's understanding of its job.
   */
  instructions?: string;

  /**
   * Where the agent operates. Root for file tools, skill discovery, memory.
   * Default: process.cwd()
   */
  workspaceRoot?: string;

  // ── Escape hatches (power users only) ──────────────────────────────

  /**
   * Override the auto-selected model.
   * Most users should never touch this — the agent picks the best
   * available model from your API keys.
   */
  model?: LanguageModel;

  /**
   * Safety limit on tool-loop iterations. Default: 25
   */
  maxSteps?: number;

  /**
   * Token/request caps. Throws UsageLimitExceeded when hit.
   */
  usageLimits?: UsageLimits;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Agent V2 Instance
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * A v2 agent instance. Stream-only — no generate().
 */
export interface AgentV2 {
  /** The agent's name. */
  readonly name: string;

  /** Initialize async resources (memory, telemetry). Called automatically by stream(). */
  init(): Promise<void>;

  /**
   * Stream a response. This is the only way to run a v2 agent.
   * Returns the AI SDK stream result.
   */
  stream(input: { prompt: string }): Promise<AgentV2StreamResult>;

  /** Get the current system prompt (includes auto-injected context + memory). */
  getSystemPrompt(): string;

  /** Get the list of all tool names available to this agent. */
  getToolNames(): string[];
}

/**
 * Stream result from a v2 agent.
 * Wraps the AI SDK ToolLoopAgent stream result with additional metadata.
 */
export interface AgentV2StreamResult {
  /** Async iterable of stream chunks (text deltas, tool calls, tool results, etc.) */
  fullStream: AsyncIterable<{ type: string; text?: string; [key: string]: unknown }>;
  /** Promise-like that resolves to the final text output. */
  text: PromiseLike<string>;
  /** Promise-like that resolves to token usage. */
  usage: PromiseLike<LanguageModelUsage>;
}

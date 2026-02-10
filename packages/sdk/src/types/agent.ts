/**
 * @fileoverview Core type definitions for AgentOptions and related configuration types.
 * These types define the interface for the createAgent() factory function.
 */

import type { LanguageModel, Tool, StepResult, ToolSet } from 'ai';
import type { SkillsConfig } from '../skills/types';
import type { MemoryEngine } from '../memory/engine';
import type { UsageLimits } from '../usage-limits';
import type { ReflectionConfig } from '../reflection';
import type { ApprovalConfig } from '../tools/approval';
import type { GuardrailsConfig } from '../guardrails/types';

// ═══════════════════════════════════════════════════════════════════════════════
// Main AgentOptions Interface
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Configuration options for creating an agent via createAgent().
 */
export interface AgentOptions {
  // ─────────────────────────────────────────────────────────────────────────────
  // Identity
  // ─────────────────────────────────────────────────────────────────────────────

  /** System prompt/instructions for the agent. Overrides role-based defaults. */
  systemPrompt?: string;

  /** Predefined role with associated system prompt and call options. */
  role?: AgentRole;

  /** Unique identifier for the agent instance. */
  agentId?: string;

  // ─────────────────────────────────────────────────────────────────────────────
  // Execution
  // ─────────────────────────────────────────────────────────────────────────────

  /** Maximum number of tool execution steps. Default: 10 */
  maxSteps?: number;

  /** Token and request caps. Throws UsageLimitExceeded when exceeded.
   * @example
   * ```typescript
   * const agent = createAgent({
   *   usageLimits: { maxRequests: 20, maxTotalTokens: 100_000 },
   * });
   * ```
   */
  usageLimits?: UsageLimits;

  /** Condition to stop agent execution. */
  stopWhen?: 'task_complete' | 'max_steps' | StopFunction;

  /** Reflection strategy injected between tool steps.
   * 'reflact' injects goal-state reflection after every step.
   * 'periodic' injects reflection every N steps (configurable via frequency).
   * 'none' preserves default behavior (no reflection).
   * @example
   * ```typescript
   * const agent = createAgent({
   *   reflection: { strategy: 'reflact' },
   * });
   * ```
   */
  reflection?: ReflectionConfig;

  // ─────────────────────────────────────────────────────────────────────────────
  // Model
  // ─────────────────────────────────────────────────────────────────────────────

  /** Language model instance. Takes precedence over provider/name. */
  model?: LanguageModel;

  /** Model provider to use for automatic model resolution. */
  modelProvider?: ModelProvider;

  /** Model name/identifier within the provider. */
  modelName?: string;

  // ─────────────────────────────────────────────────────────────────────────────
  // Tools
  // ─────────────────────────────────────────────────────────────────────────────

  /** Custom tools to add to the agent. Merged with preset tools. */
  tools?: Record<string, Tool>;

  /** Predefined tool preset to use. Default: 'standard' */
  toolPreset?: ToolPreset;

  /** Specific tools to enable (whitelist). If set, only these tools are active. */
  enableTools?: string[];

  /** Specific tools to disable (blacklist). Removed from preset/custom tools. */
  disableTools?: string[];

  /** Maximum retries per tool when a ModelRetry error is thrown. Default: 3 */
  maxToolRetries?: number;

  /** Require human approval before executing dangerous tools.
   * `true` enables approval for default dangerous tools (shell, browser, file_write, file_edit).
   * Provide an ApprovalConfig object for fine-grained control.
   * @example
   * ```typescript
   * const agent = createAgent({
   *   approval: true, // enable for default dangerous tools
   * });
   * // or
   * const agent = createAgent({
   *   approval: { enabled: true, tools: ['shell'], timeout: 30000 },
   * });
   * ```
   */
  approval?: boolean | ApprovalConfig;

  /** Guardrails for input/output validation.
   * Input guardrails run before the agent; output guardrails run after.
   * Both phases execute their guardrails in parallel with fast-fail.
   * @example
   * ```typescript
   * const agent = createAgent({
   *   guardrails: {
   *     output: [contentFilter(), lengthLimit({ maxChars: 5000 })],
   *     onBlock: 'retry',
   *   },
   * });
   * ```
   */
  guardrails?: GuardrailsConfig;

  // ─────────────────────────────────────────────────────────────────────────────
  // Sub-Agents
  // ─────────────────────────────────────────────────────────────────────────────

  /** Enable spawn_agent tool for sub-agent delegation. Default: false */
  enableSubAgents?: boolean;

  /** Custom configurations for specific sub-agent roles. */
  subAgentRoles?: Record<string, SubAgentConfig>;

  /** Maximum depth of sub-agent spawning to prevent infinite recursion. Default: 2 */
  maxSpawnDepth?: number;

  // ─────────────────────────────────────────────────────────────────────────────
  // Streaming
  // ─────────────────────────────────────────────────────────────────────────────

  /** Enable transient streaming for tool data (file contents, shell output, etc). Default: true */
  enableTransientStreaming?: boolean;

  // ─────────────────────────────────────────────────────────────────────────────
  // Workflow / Durability
  // ─────────────────────────────────────────────────────────────────────────────

  /** Enable durable workflow wrapping for tool executions. Default: true */
  durable?: boolean;

  /** Configuration for workflow durability. */
  workflowOptions?: WorkflowOptions;

  // ─────────────────────────────────────────────────────────────────────────────
  // Memory
  // ─────────────────────────────────────────────────────────────────────────────

  /** Unified memory engine (preferred). Provides remember, recall, forget, query_knowledge tools.
   * When provided, automatically injects memory tools into the agent.
   * @example
   * ```typescript
   * const engine = createMemoryEngine({ vectorStore, graphStore, extractionModel });
   * const agent = createAgent({ memoryEngine: engine });
   * ```
   */
  memoryEngine?: MemoryEngine;

  /** Enable vector memory for the agent. Default: false */
  enableMemory?: boolean;

  /** Configuration for vector memory store. */
  memoryOptions?: MemoryOptions;

  // ─────────────────────────────────────────────────────────────────────────────
  // Skills
  // ─────────────────────────────────────────────────────────────────────────────

  /** Skills to inject into the agent's system prompt.
   * Skills are discovered from SKILL.md files in configured directories.
   * @example
   * ```typescript
   * const agent = createAgent({
   *   skills: { directories: ['.agents/skills'] },
   * });
   * ```
   */
  skills?: SkillsConfig;

  // ─────────────────────────────────────────────────────────────────────────────
  // Brain (Knowledge Graph + Memory) — DEPRECATED
  // ─────────────────────────────────────────────────────────────────────────────

  /** @deprecated Use `memoryEngine` instead. Brain instance for knowledge graph and persistent memory. */
  brain?: BrainInstance;

  // ─────────────────────────────────────────────────────────────────────────────
  // Environment
  // ─────────────────────────────────────────────────────────────────────────────

  /** Root directory for file operations. Used for path security. */
  workspaceRoot?: string;

  // ─────────────────────────────────────────────────────────────────────────────
  // Handlers / Callbacks
  // ─────────────────────────────────────────────────────────────────────────────

  /** Handler for agent asking user questions. */
  askUserHandler?: AskUserHandler;

  /** Callback fired after each tool execution step. */
  onStepFinish?: StepFinishCallback;

  /** Callback for streaming events. */
  onEvent?: StreamEventCallback;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Supporting Types
// ═══════════════════════════════════════════════════════════════════════════════

/** Predefined agent roles with associated configurations. */
export type AgentRole = 'generic' | 'coder' | 'researcher' | 'analyst';

/** Supported model providers. */
export type ModelProvider = 'openrouter' | 'ollama' | 'openai' | 'anthropic' | 'google';

/** Predefined tool presets. */
export type ToolPreset = 'none' | 'minimal' | 'standard' | 'full';

/** Custom stop condition function. */
export type StopFunction = (ctx: StopContext) => boolean;

/** Context passed to stop condition function. */
export interface StopContext {
  steps: StepResult<ToolSet>[];
  stepCount: number;
}

/** Handler for user interaction requests. */
export type AskUserHandler = (question: string) => Promise<string>;

/** Callback for step completion. */
export type StepFinishCallback = (step: StepResult<ToolSet>, index: number) => void | Promise<void>;

/** Callback for streaming events. */
export type StreamEventCallback = (event: StreamEvent) => void;

/** Stream event types. */
export interface StreamEvent {
  type: 'text-delta' | 'tool-call' | 'tool-result' | 'step-finish' | 'finish';
  data: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-Agent Configuration
// ─────────────────────────────────────────────────────────────────────────────

/** Configuration for a sub-agent role. */
export interface SubAgentConfig {
  /** Custom instructions for this sub-agent role. */
  instructions?: string;

  /** Tools available to this sub-agent. */
  tools?: string[];

  /** Model name/identifier for this sub-agent. */
  model?: string;

  /** Maximum steps for the sub-agent. Default: 5 */
  maxSteps?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Workflow Configuration
// ─────────────────────────────────────────────────────────────────────────────

/** Configuration for workflow durability. */
export interface WorkflowOptions {
  /** Default retry count for failed tool executions. Default: 3 */
  defaultRetryCount?: number;

  /** Default timeout for tool executions. Format: "30s", "5m", "1h". Default: "5m" */
  defaultTimeout?: string;

  /** Whether independent tools should run in parallel. Default: true */
  parallelIndependent?: boolean;

  /** Storage backend for workflow state. Default: 'memory' */
  storage?: 'vercel' | 'sqlite' | 'memory';

  /** Workflow run ID for resumption. */
  workflowRunId?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Memory Configuration
// ─────────────────────────────────────────────────────────────────────────────

/** Configuration for vector memory store. */
export interface MemoryOptions {
  /** Path to persist memory index. If not provided, uses in-memory. */
  path?: string;

  /** Embedding model to use. Default: 'text-embedding-3-small' */
  embedModel?: string;

  /** Maximum number of results to return from memory queries. Default: 5 */
  topK?: number;

  /** Similarity threshold for memory retrieval. Default: 0.7 */
  similarityThreshold?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Brain Configuration
// ─────────────────────────────────────────────────────────────────────────────

/** Brain instance type (imported from @agent/brain at runtime) */
export interface BrainInstance {
  query(term: string, limit?: number): Promise<unknown[]>;
  remember(fact: string, metadata?: Record<string, unknown>): Promise<void>;
  recall(query: string, limit?: number): Promise<unknown[]>;
  extract(text: string, source?: string): Promise<unknown>;
  close(): Promise<void>;
}

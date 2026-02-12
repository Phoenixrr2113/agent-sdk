/**
 * @agntk/core — Slim main entry point.
 *
 * The 80/20 exports: everything most users need.
 * Advanced features live in sub-path imports:
 *   - @agntk/core/workflow   — durability, hooks, teams, scheduling
 *   - @agntk/core/tools      — tool builders, browser, spawn-agent
 *   - @agntk/core/evals      — eval suite and assertions
 *   - @agntk/core/advanced   — guardrail runners, best-of-n, observability, streaming internals
 */

// ═══════════════════════════════════════════════════════════════════════════════
// Core — the essentials
// ═══════════════════════════════════════════════════════════════════════════════

export { createAgent } from './agent';
export type { Agent } from './agent';

// V2 Agent — zero-config, fully equipped
export { createAgentV2 } from './agent-v2';
export type { AgentV2, AgentOptionsV2, AgentV2StreamResult } from './types/agent-v2';

export type {
  AgentOptions,
  AgentRole,
  ToolPreset,
  ModelProvider,
  SubAgentConfig,
  WorkflowOptions,
  MemoryOptions,
  StopFunction,
  StopContext,
  AskUserHandler,
  StepFinishCallback,
  StreamEventCallback,
  StreamEvent,
} from './types/agent';

// ═══════════════════════════════════════════════════════════════════════════════
// Models
// ═══════════════════════════════════════════════════════════════════════════════

export { resolveModel, models } from './models';

// ═══════════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════════

export {
  loadConfig,
  getConfig,
  configure,
  defineConfig,
  getModelForTier,
  DEFAULT_MODELS,
  DEFAULT_PROVIDER,
} from './config';
export type { AgentConfig, PartialAgentConfig, ModelsConfig, ModelTier, Provider } from './config';

// ═══════════════════════════════════════════════════════════════════════════════
// Presets
// ═══════════════════════════════════════════════════════════════════════════════

export { toolPresets, createToolPreset } from './presets/tools';
export type { ToolPresetLevel, ToolPresetOptions } from './presets/tools';
export { roleConfigs } from './presets/roles';

// ═══════════════════════════════════════════════════════════════════════════════
// Skills
// ═══════════════════════════════════════════════════════════════════════════════

export type { SkillsConfig, SkillMeta, SkillContent } from './skills';
export { loadSkills, discoverSkills } from './skills';

// ═══════════════════════════════════════════════════════════════════════════════
// Usage Limits
// ═══════════════════════════════════════════════════════════════════════════════

export { UsageLimitExceeded, usageLimitStop } from './usage-limits';
export type { UsageLimits, UsageLimitType } from './usage-limits';

// ═══════════════════════════════════════════════════════════════════════════════
// Approval & Guardrails — types only (runners in @agntk/core/advanced)
// ═══════════════════════════════════════════════════════════════════════════════

export type { ApprovalConfig } from './tools/approval';
export type { GuardrailsConfig, Guardrail, GuardrailResult } from './guardrails/types';

// ═══════════════════════════════════════════════════════════════════════════════
// Reflection — types only (internals in @agntk/core/advanced)
// ═══════════════════════════════════════════════════════════════════════════════

export type { ReflectionStrategy, ReflectionConfig } from './reflection';

// ═══════════════════════════════════════════════════════════════════════════════
// Logger — import directly from @agntk/logger
// ═══════════════════════════════════════════════════════════════════════════════
// Removed: shadow logger re-exports (BUG-001).
// Use: import { createLogger } from '@agntk/logger';

// ═══════════════════════════════════════════════════════════════════════════════
// Memory
// ═══════════════════════════════════════════════════════════════════════════════

export type { MemoryStore, MemoryConfig } from './memory/types';
export { MarkdownMemoryStore } from './memory/store';
export type { MarkdownMemoryStoreOptions } from './memory/store';
export { loadMemoryContext } from './memory/loader';

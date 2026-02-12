/**
 * @agntk/core/advanced — Advanced features.
 *
 * Guardrail runners, approval internals, reflection internals,
 * best-of-n, browser streaming, observability, streaming types,
 * and other power-user features.
 *
 * Import from '@agntk/core/advanced' instead of '@agntk/core'.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// Reflection (internals)
// ═══════════════════════════════════════════════════════════════════════════════

export { buildReflectionPrompt, createReflectionPrepareStep, estimateReflectionTokens } from '../reflection';
export type { ReflectionStrategy, ReflectionConfig } from '../reflection';

// ═══════════════════════════════════════════════════════════════════════════════
// Guardrails (runners + built-ins)
// ═══════════════════════════════════════════════════════════════════════════════

export { contentFilter, topicFilter, lengthLimit, custom } from '../guardrails/built-ins';
export { runGuardrails, wrapWithGuardrails, handleGuardrailResults, buildRetryFeedback } from '../guardrails/runner';
export { GuardrailBlockedError } from '../guardrails/types';
export type { Guardrail, GuardrailResult, GuardrailContext, GuardrailsConfig, OnBlockAction } from '../guardrails/types';

// ═══════════════════════════════════════════════════════════════════════════════
// Approval (internals)
// ═══════════════════════════════════════════════════════════════════════════════

export { applyApproval, resolveApprovalConfig, isDangerousTool, DANGEROUS_TOOLS } from '../tools/approval';
export type { ApprovalConfig, ApprovalHandler, ApprovalRequest } from '../tools/approval';

// ═══════════════════════════════════════════════════════════════════════════════
// Best-of-N
// ═══════════════════════════════════════════════════════════════════════════════

export { withBestOfN } from '../wrappers/best-of-n';
export type { BestOfNConfig, BestOfNCandidate, BestOfNResult } from '../wrappers/best-of-n';

// ═══════════════════════════════════════════════════════════════════════════════
// Browser Streaming
// ═══════════════════════════════════════════════════════════════════════════════

export { createBrowserStream, BrowserStreamEmitter } from '../tools/browser/stream';
export type { BrowserStreamConfig, FrameData, InputEvent, BrowserStreamEvent } from '../tools/browser/stream';

// ═══════════════════════════════════════════════════════════════════════════════
// Observability
// ═══════════════════════════════════════════════════════════════════════════════

export { initObservability, createTelemetrySettings, isObservabilityEnabled, shutdownObservability } from '../observability';
export type { ObservabilityConfig, LangfuseConfig, TelemetrySettings } from '../observability';

// ═══════════════════════════════════════════════════════════════════════════════
// Streaming Types
// ═══════════════════════════════════════════════════════════════════════════════

export type {
  StreamEventType,
  StreamEventDataMap,
  SessionStartData,
  StepStartData,
  StepFinishData,
  TextDeltaData,
  TextFinishData,
  ReasoningDeltaData,
  ReasoningFinishData,
  ToolCallData,
  ToolResultData,
  SourceData,
  ErrorData,
  CompleteData,
  MessagePartType,
  MessagePart,
  ToolCallInfo,
  SourceInfo,
  StreamingMessage,
} from '../types/streaming';

// ═══════════════════════════════════════════════════════════════════════════════
// Tool Lifecycle Types
// ═══════════════════════════════════════════════════════════════════════════════

export type { ToolLifecycle, ToolContext, ToolError, ToolErrorType } from '../types/lifecycle';

// ═══════════════════════════════════════════════════════════════════════════════
// Prompts (internals)
// ═══════════════════════════════════════════════════════════════════════════════

export { buildSystemContext, formatSystemContextBlock, buildDynamicSystemPrompt } from '../prompts/context';
export type { SystemContext } from '../prompts/context';

// ═══════════════════════════════════════════════════════════════════════════════
// Sub-Agent Configs
// ═══════════════════════════════════════════════════════════════════════════════

export { subAgentConfigs, getSubAgentConfig, subAgentRoles } from '../presets/sub-agent-configs';
export type { SubAgentRole } from '../presets/sub-agent-configs';

// ═══════════════════════════════════════════════════════════════════════════════
// Skills Search (advanced)
// ═══════════════════════════════════════════════════════════════════════════════

export { loadSkillsFromPaths, buildSkillsSystemPrompt, searchSkills, filterEligibleSkills, isSkillEligible } from '../skills';
export type { SkillSearchResult } from '../skills';

// ═══════════════════════════════════════════════════════════════════════════════
// Logger — import directly from @agntk/logger
// ═══════════════════════════════════════════════════════════════════════════════
// Removed: shadow logger type re-exports (BUG-001).
// Use: import { type LoggerOptions, ... } from '@agntk/logger';

// ═══════════════════════════════════════════════════════════════════════════════
// Usage Limits (extended types)
// ═══════════════════════════════════════════════════════════════════════════════

export type { UsageSnapshot } from '../usage-limits';

// ═══════════════════════════════════════════════════════════════════════════════
// Pool (SpecialistPool)
// ═══════════════════════════════════════════════════════════════════════════════

export { SpecialistPool, createPoolTools, createSpawnSpecialistTool, createListSpecialistsTool } from '../pool';
export type {
  SpecialistPoolConfig,
  SpecialistConfig,
  CachedSpecialist,
  ConversationMessage,
  SpecialistAgent,
  HistoryStrategy,
} from '../pool';

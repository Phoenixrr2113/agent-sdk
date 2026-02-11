// @agntk/core - Main exports

// Core
export { createAgent } from './agent';
export type { AgentOptions, SubAgentConfig, WorkflowOptions, MemoryOptions } from './types/agent';
export type { SkillsConfig, SkillMeta, SkillContent } from './skills';
export { discoverSkills, loadSkills, loadSkillsFromPaths, buildSkillsSystemPrompt } from './skills';

// Reflection
export { buildReflectionPrompt, createReflectionPrepareStep, estimateReflectionTokens } from './reflection';
export type { ReflectionStrategy, ReflectionConfig } from './reflection';

// Types
export type { ToolLifecycle, ToolContext, ToolError, ToolErrorType } from './types/lifecycle';
export type { AgentDataParts } from './streaming/data-parts';

// Streaming Types
export type {
  StreamEventType,
  StreamEvent,
  StreamEventCallback,
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
} from './types/streaming';

// Logger
export { createLogger, logger } from './utils/logger';
export type { Logger, LogLevel, LoggerOptions, LogEntry, LogSubscriber, AgentContext as LoggerAgentContext } from './utils/logger';

// Prompts
export { systemPrompt, rolePrompts } from './prompts/templates';
export { buildSystemContext, formatSystemContextBlock, buildDynamicSystemPrompt } from './prompts/context';
export type { SystemContext } from './prompts/context';

// Presets
export { toolPresets, createToolPreset } from './presets/tools';
export type { ToolPresetLevel, ToolPresetOptions } from './presets/tools';
export { roleConfigs } from './presets/roles';
export { subAgentConfigs, getSubAgentConfig, subAgentRoles } from './presets/sub-agent-configs';
export type { SubAgentRole } from './presets/sub-agent-configs';

// Streaming
export { withTransientStreaming, streamTransient } from './streaming/transient';

// Tools
export { createSpawnAgentTool } from './tools/spawn-agent/index';
export { createSearchSkillsTool, clearSkillsCache } from './tools/search-skills';
export type { SearchSkillsToolConfig } from './tools/search-skills';

// Skills Search (from loader)
export { searchSkills, filterEligibleSkills, isSkillEligible } from './skills';
export type { SkillSearchResult } from './skills';

// Approval
export { applyApproval, resolveApprovalConfig, isDangerousTool, DANGEROUS_TOOLS } from './tools/approval';
export type { ApprovalConfig, ApprovalHandler, ApprovalRequest } from './tools/approval';

// Guardrails
export { contentFilter, topicFilter, lengthLimit, custom as customGuardrail } from './guardrails/built-ins';
export { runGuardrails, wrapWithGuardrails, handleGuardrailResults, buildRetryFeedback } from './guardrails/runner';
export { GuardrailBlockedError } from './guardrails/types';
export type { Guardrail, GuardrailResult, GuardrailContext, GuardrailsConfig, OnBlockAction } from './guardrails/types';

// Best-of-N
export { withBestOfN } from './wrappers/best-of-n';
export type { BestOfNConfig, BestOfNCandidate, BestOfNResult } from './wrappers/best-of-n';

// Browser Streaming
export { createBrowserStream, BrowserStreamEmitter } from './tools/browser/stream';
export type { BrowserStreamConfig, FrameData, InputEvent, BrowserStreamEvent } from './tools/browser/stream';

// Memory
export { createMemoryStore } from './memory/vectra-store';
export { createMemoryTools } from './memory/tools';
export { createMemoryEngine } from './memory/engine';
export type { MemoryEngine, MemoryEngineConfig, MemoryWriteResult, MemoryGraphStore, ContradictionDetectorPort } from './memory/engine';
export type { MemoryStore, MemoryItem, MemorySearchResult } from './memory/vectra-store';
export type { MemoryNetworkType, MemoryOperation, ExtractedFact } from './memory/extraction';

// Usage Limits
export { UsageLimitExceeded, usageLimitStop } from './usage-limits';
export type { UsageLimits, UsageLimitType, UsageSnapshot } from './usage-limits';

// Evals
export { createEvalSuite, toolCalled, noToolCalled, toolCalledTimes, outputMatches, outputContains, stepCount, tokenUsage, llmJudge, custom } from './evals';
export type { EvalSuiteConfig, EvalSuiteResult, EvalCaseResult, EvalCase, EvalAgentResult, Assertion, AssertionResult, EvalReporter } from './evals';

// Models
export { resolveModel, models } from './models';

// Observability
export { initObservability, createTelemetrySettings, isObservabilityEnabled, shutdownObservability } from './observability';
export type { ObservabilityConfig, LangfuseConfig, TelemetrySettings } from './observability';

// Configuration
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

// Workflow / Durability
export {
  /** @deprecated Use `createAgent({ durable: true })` instead. */
  createDurableAgent,
  checkWorkflowAvailability,
  wrapToolAsDurableStep,
  wrapToolsAsDurable,
  wrapSelectedToolsAsDurable,
  parseDuration,
  formatDuration,
} from './workflow';
export type { DurableAgent, DurableAgentOptions, DurableGenerateResult, DurabilityConfig } from './workflow';

// Workflow Templates
export { withApproval, withSchedule } from './workflow';
export type { WorkflowTemplateResult, ApprovalResponse, WithApprovalOptions, WithScheduleOptions } from './workflow';

// Workflow Hooks & Human-in-the-Loop
export {
  defineHook,
  createWebhook,
  resumeHook,
  sleep,
  getHookRegistry,
  getWdkErrors,
  HookRegistry,
  HookNotFoundError,
  HookNotPendingError,
  HookRejectedError,
  FatalError,
  RetryableError,
} from './workflow';
export type {
  Hook,
  HookDefinition,
  HookInstance,
  HookStatus,
  WebhookOptions,
  WebhookResult,
  SleepOptions,
} from './workflow';

// Workflow Builders
export { createPipeline, createParallel, asStep } from './workflow';
export type { Workflow, WorkflowStep, WorkflowInput, WorkflowOutput, SynthesizeFn, PipelineConfig, ParallelConfig } from './workflow';

// Scheduled Workflows
export {
  createScheduledWorkflow,
  createDailyBriefing,
  createWeeklyReport,
} from './workflow';
export type {
  ScheduledWorkflowConfig,
  ScheduledWorkflow,
  ScheduleTickResult,
  ScheduleResult,
  DailyBriefingOptions,
  WeeklyReportOptions,
} from './workflow';

// SpecialistPool
export { SpecialistPool, createPoolTools, createSpawnSpecialistTool, createListSpecialistsTool } from './pool';
export type {
  SpecialistPoolConfig,
  SpecialistConfig,
  CachedSpecialist,
  ConversationMessage,
  SpecialistAgent,
  HistoryStrategy,
} from './pool';

// Team Coordination
export { createTeam, TaskBoard, createTeamTools, teamCoordinationMachine, teammateMachine } from './workflow';
export type {
  TeamConfig,
  TeamMemberConfig,
  Team,
  TeamPhase,
  TeammatePhase,
  TeamMessage,
  TeamOutput,
  TaskDefinition,
  TaskState,
  TeamSnapshot,
} from './workflow';

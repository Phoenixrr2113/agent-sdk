/**
 * @agntk/core - Workflow Module
 *
 * Exports for workflow durability and orchestration.
 * Provides durable agent wrapping and tool checkpointing
 * via the Workflow DevKit.
 *
 * @see https://useworkflow.dev
 */

// Durable tool wrappers
export {
  wrapToolAsDurableStep,
  wrapToolsAsDurable,
  wrapSelectedToolsAsDurable,
  wrapToolAsIndependentStep,
  getDurabilityConfig,
  setDurabilityConfig,
  getStepName,
  DURABILITY_CONFIG,
  type DurabilityConfig,
} from './durable-tool';

// Durable agent factory
// NOTE: createDurableAgent and its types are deprecated — use createAgent({ durable: true }) instead.
export {
  /** @deprecated Use `createAgent({ durable: true })` instead. */
  createDurableAgent,
  checkWorkflowAvailability,
  parseDuration,
  formatDuration,
  _resetWorkflowCache,
  /** @deprecated Use `createAgent({ durable: true })` instead. */
  type DurableAgent,
  /** @deprecated Use `createAgent({ durable: true })` instead. */
  type DurableAgentOptions,
  /** @deprecated Use `createAgent({ durable: true })` instead. */
  type DurableGenerateResult,
  /** @deprecated Use `createAgent({ durable: true })` instead. */
  type WebhookResponse,
} from './durable-agent';

// Standalone workflow templates
export {
  withApproval,
  withSchedule,
  type WorkflowTemplateResult,
  type ApprovalResponse,
  type WithApprovalOptions,
  type WithScheduleOptions,
} from './templates';

// Workflow hooks & human-in-the-loop
export {
  defineHook,
  createWebhook,
  resumeHook,
  sleep,
  getHookRegistry,
  getWdkErrors,
  _resetHookRegistry,
  _resetHookCounter,
  _resetWdkCache,
  HookRegistry,
  HookNotFoundError,
  HookNotPendingError,
  HookRejectedError,
  FatalError,
  RetryableError,
  type Hook,
  type HookDefinition,
  type HookInstance,
  type HookStatus,
  type WebhookOptions,
  type WebhookResult,
  type SleepOptions,
} from './hooks';

// Workflow builders (Pipeline, Parallel)
export {
  createPipeline,
  createParallel,
  asStep,
  type Workflow,
  type WorkflowStep,
  type WorkflowInput,
  type WorkflowOutput,
  type SynthesizeFn,
  type PipelineConfig,
  type ParallelConfig,
} from './builders';

// Scheduled workflows
export {
  createScheduledWorkflow,
  createDailyBriefing,
  createWeeklyReport,
  type ScheduledWorkflowConfig,
  type ScheduledWorkflow,
  type ScheduleTickResult,
  type ScheduleResult,
  type DailyBriefingOptions,
  type WeeklyReportOptions,
} from './schedulers';

// Team coordination
export {
  createTeam,
  TaskBoard,
  createTeamTools,
  teamCoordinationMachine,
  teammateMachine,
  type TeamConfig,
  type TeamMemberConfig,
  type Team,
  type TeamPhase,
  type TeammatePhase,
  type TeamMessage,
  type TeamOutput,
  type TaskDefinition,
  type TaskState,
  type TeamSnapshot,
} from './team';

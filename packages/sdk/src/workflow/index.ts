/**
 * @agent/sdk - Workflow Module
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
export {
  createDurableAgent,
  checkWorkflowAvailability,
  parseDuration,
  formatDuration,
  _resetWorkflowCache,
  type DurableAgent,
  type DurableAgentOptions,
  type DurableGenerateResult,
  type WebhookResponse,
} from './durable-agent';

// Workflow hooks & human-in-the-loop
export {
  defineHook,
  createWebhook,
  sleep,
  getHookRegistry,
  _resetHookRegistry,
  _resetHookCounter,
  HookRegistry,
  HookNotFoundError,
  HookNotPendingError,
  HookRejectedError,
  type Hook,
  type HookDefinition,
  type HookInstance,
  type HookStatus,
  type WebhookOptions,
  type WebhookResult,
  type SleepOptions,
} from './hooks';

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

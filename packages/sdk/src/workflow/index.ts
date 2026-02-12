/**
 * @agntk/core - Workflow Module
 *
 * Exports for workflow durability and hooks.
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

// Workflow utilities (runtime detection, duration helpers)
export {
  checkWorkflowAvailability,
  parseDuration,
  formatDuration,
  _resetWorkflowCache,
} from './utils';

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

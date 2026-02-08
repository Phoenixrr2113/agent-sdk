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

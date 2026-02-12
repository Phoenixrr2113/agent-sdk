/**
 * @fileoverview Type definitions for observability providers.
 */

/**
 * Observability provider configuration.
 */
export interface ObservabilityConfig {
  /** Provider name. Currently supports 'langfuse'. */
  provider: 'langfuse';

  /** Langfuse-specific configuration. */
  langfuse?: LangfuseConfig;
}

/**
 * Langfuse configuration.
 */
export interface LangfuseConfig {
  /** Langfuse public key. Falls back to LANGFUSE_PUBLIC_KEY env var. */
  publicKey?: string;

  /** Langfuse secret key. Falls back to LANGFUSE_SECRET_KEY env var. */
  secretKey?: string;

  /** Langfuse base URL. Falls back to LANGFUSE_BASEURL or https://cloud.langfuse.com. */
  baseUrl?: string;

  /** Enable/disable debug logging. Default: false */
  debug?: boolean;
}

/**
 * Telemetry settings to pass to AI SDK calls.
 * This is a simplified subset of the AI SDK's TelemetrySettings.
 * The full AI SDK type uses AttributeValue from @opentelemetry/api,
 * but we accept Record<string, unknown> for a simpler API.
 */
export interface TelemetrySettings {
  isEnabled: boolean;
  functionId?: string;
  metadata?: Record<string, unknown>;
}

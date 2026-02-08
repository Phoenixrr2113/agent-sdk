/**
 * @fileoverview Langfuse observability integration for AI SDK.
 * Uses OpenTelemetry to trace AI SDK calls via Langfuse.
 *
 * This module is designed to be optional — langfuse is a peer dependency.
 * If not installed, observability features gracefully degrade (no-op).
 */

import { createLogger } from '@agent/logger';
import type { ObservabilityConfig, TelemetrySettings } from './types';

const log = createLogger('@agent/sdk:observability');

let initialized = false;

/**
 * Initialize observability provider (currently Langfuse).
 *
 * Must be called before any AI SDK calls to enable tracing.
 * This sets up the OpenTelemetry span processor that sends
 * traces to Langfuse.
 *
 * @example
 * ```typescript
 * import { initObservability } from '@agent/sdk';
 *
 * await initObservability({
 *   provider: 'langfuse',
 *   langfuse: {
 *     publicKey: process.env.LANGFUSE_PUBLIC_KEY,
 *     secretKey: process.env.LANGFUSE_SECRET_KEY,
 *   },
 * });
 * ```
 */
export async function initObservability(config: ObservabilityConfig): Promise<boolean> {
  if (initialized) {
    log.warn('Observability already initialized, skipping');
    return true;
  }

  if (config.provider !== 'langfuse') {
    log.error('Unsupported observability provider', { provider: config.provider });
    return false;
  }

  try {
    // Dynamic import via Function to bypass TypeScript module resolution.
    // These are optional peer deps that may not be installed.
    const dynamicImport = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<Record<string, unknown>>;

    const langfuseModule = await dynamicImport('langfuse-vercel') as { LangfuseExporter: new (config: Record<string, unknown>) => unknown };

    const publicKey = config.langfuse?.publicKey ?? process.env.LANGFUSE_PUBLIC_KEY;
    const secretKey = config.langfuse?.secretKey ?? process.env.LANGFUSE_SECRET_KEY;
    const baseUrl = config.langfuse?.baseUrl ?? process.env.LANGFUSE_BASEURL ?? 'https://cloud.langfuse.com';

    if (!publicKey || !secretKey) {
      log.warn('Langfuse keys not provided, observability disabled');
      return false;
    }

    // Register the exporter with OpenTelemetry
    const otelModule = await dynamicImport('@vercel/otel') as { registerOTel: (config: Record<string, unknown>) => void };

    otelModule.registerOTel({
      serviceName: 'agent-sdk',
      traceExporter: new langfuseModule.LangfuseExporter({
        publicKey,
        secretKey,
        baseUrl,
        debug: config.langfuse?.debug ?? false,
      }),
    });

    initialized = true;
    log.info('Langfuse observability initialized', { baseUrl });
    return true;
  } catch (error) {
    // Graceful degradation — langfuse not installed or failed to init
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes('Cannot find module') || message.includes('MODULE_NOT_FOUND')) {
      log.info('Langfuse not installed, observability features disabled. Install with: pnpm add langfuse-vercel @vercel/otel');
    } else {
      log.warn('Failed to initialize Langfuse observability', { error: message });
    }

    return false;
  }
}

/**
 * Create telemetry settings for AI SDK calls.
 * Returns settings that enable OpenTelemetry tracing.
 */
export function createTelemetrySettings(options?: {
  functionId?: string;
  metadata?: Record<string, unknown>;
}): TelemetrySettings {
  return {
    isEnabled: initialized,
    functionId: options?.functionId,
    metadata: options?.metadata,
  };
}

/**
 * Check if observability is currently initialized.
 */
export function isObservabilityEnabled(): boolean {
  return initialized;
}

/**
 * Shutdown observability (flush pending traces).
 * Call this during graceful shutdown.
 */
export async function shutdownObservability(): Promise<void> {
  if (!initialized) return;

  try {
    // The registered OTel provider handles shutdown via process events
    log.info('Observability shutdown requested');
    initialized = false;
  } catch (error) {
    log.warn('Error during observability shutdown', { error: String(error) });
  }
}

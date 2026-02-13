/**
 * @fileoverview Langfuse observability integration for AI SDK.
 * Uses OpenTelemetry to trace AI SDK calls via Langfuse.
 *
 * This module is designed to be optional — langfuse is a peer dependency.
 * If not installed, observability features gracefully degrade (no-op).
 */

import { createLogger } from '@agntk/logger';
import type { ObservabilityConfig, TelemetrySettings } from './types';

const log = createLogger('@agntk/core:observability');

let initialized = false;

// Hold references for shutdown/flush
let tracerProviderRef: { forceFlush: () => Promise<void>; shutdown: () => Promise<void> } | null = null;

/**
 * Initialize observability provider (currently Langfuse).
 *
 * Must be called before any AI SDK calls to enable tracing.
 * This sets up a NodeTracerProvider with a SimpleSpanProcessor
 * that sends traces to Langfuse via the LangfuseExporter.
 *
 * @example
 * ```typescript
 * import { initObservability } from '@agntk/core';
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

    const langfuseModule = await dynamicImport('langfuse-vercel') as {
      LangfuseExporter: new (config: Record<string, unknown>) => unknown;
    };

    const publicKey = config.langfuse?.publicKey ?? process.env.LANGFUSE_PUBLIC_KEY;
    const secretKey = config.langfuse?.secretKey ?? process.env.LANGFUSE_SECRET_KEY;
    const baseUrl = config.langfuse?.baseUrl ?? process.env.LANGFUSE_BASE_URL ?? process.env.LANGFUSE_BASEURL ?? 'https://cloud.langfuse.com';

    if (!publicKey || !secretKey) {
      log.warn('Langfuse keys not provided, observability disabled');
      return false;
    }

    // Create the Langfuse exporter
    const exporter = new langfuseModule.LangfuseExporter({
      publicKey,
      secretKey,
      baseUrl,
      debug: config.langfuse?.debug ?? false,
    });

    // Use NodeTracerProvider + BatchSpanProcessor for proper trace export.
    // @vercel/otel's registerOTel creates a ProxyTracerProvider that doesn't
    // actually export spans outside of Vercel's runtime.
    const nodeTracingModule = await dynamicImport('@opentelemetry/sdk-trace-node') as {
      NodeTracerProvider: new (config?: Record<string, unknown>) => {
        register: () => void;
        forceFlush: () => Promise<void>;
        shutdown: () => Promise<void>;
      };
      SimpleSpanProcessor: new (exporter: unknown) => unknown;
    };

    // SimpleSpanProcessor exports each span immediately (good for CLI / short-lived processes).
    const processor = new nodeTracingModule.SimpleSpanProcessor(exporter);

    // In @opentelemetry/sdk-trace-node v2.x, span processors are passed via constructor.
    const provider = new nodeTracingModule.NodeTracerProvider({
      spanProcessors: [processor],
    });
    provider.register();

    tracerProviderRef = provider;
    initialized = true;
    log.info('Langfuse observability initialized', { baseUrl });
    return true;
  } catch (error) {
    // Graceful degradation — langfuse not installed or failed to init
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes('Cannot find module') || message.includes('MODULE_NOT_FOUND')) {
      log.info('Langfuse not installed, observability features disabled. Install with: pnpm add langfuse-vercel @opentelemetry/sdk-trace-node @opentelemetry/api');
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
    // Use a getter so isEnabled reflects the live `initialized` state.
    // The settings object is created before initObservability() runs,
    // but the AI SDK reads isEnabled per-call, so this stays in sync.
    get isEnabled() {
      return initialized;
    },
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
    log.info('Observability shutdown requested — flushing traces');

    // Flush and shutdown the NodeTracerProvider which flushes all span processors
    if (tracerProviderRef) {
      await tracerProviderRef.forceFlush();
      await tracerProviderRef.shutdown();
      tracerProviderRef = null;
    }

    initialized = false;
    log.info('Observability shutdown complete');
  } catch (error) {
    log.warn('Error during observability shutdown', { error: String(error) });
    initialized = false;
  }
}

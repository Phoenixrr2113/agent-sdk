/**
 * @agntk/core - Workflow Utilities
 *
 * Shared utilities for workflow durability features:
 * - Runtime detection (checkWorkflowAvailability)
 * - Duration parsing/formatting
 *
 * @see https://useworkflow.dev
 */

import { createLogger } from '@agntk/logger';

const log = createLogger('@agntk/core:workflow:utils');

// ============================================================================
// Workflow Runtime Detection
// ============================================================================

/** Cached availability result */
let _workflowAvailable: boolean | null = null;

/**
 * Check if the Workflow DevKit runtime is available.
 * Result is cached after first check.
 */
export async function checkWorkflowAvailability(): Promise<boolean> {
  if (_workflowAvailable !== null) return _workflowAvailable;

  try {
    await import('workflow');
    _workflowAvailable = true;
    log.info('Workflow runtime detected');
    return true;
  } catch (_e: unknown) {
    _workflowAvailable = false;
    log.debug('Workflow runtime not available — durable features disabled');
    return false;
  }
}

/**
 * Reset workflow availability cache (for testing).
 * @internal
 */
export function _resetWorkflowCache(): void {
  _workflowAvailable = null;
}

// ============================================================================
// Duration Helpers
// ============================================================================

/**
 * Parse a duration string into milliseconds.
 * Supports: 30s, 5m, 1h, 1d
 */
export function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)(s|m|h|d)$/);
  if (!match) {
    throw new Error(`Invalid duration format: ${duration}. Use format like '30s', '5m', '1h', '1d'`);
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      throw new Error(`Unknown duration unit: ${unit}`);
  }
}

/**
 * Format milliseconds as a human-readable duration.
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
  if (ms < 86400000) return `${Math.round(ms / 3600000)}h`;
  return `${Math.round(ms / 86400000)}d`;
}

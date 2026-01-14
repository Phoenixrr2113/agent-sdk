/**
 * @fileoverview Global debug configuration.
 */

import type { DebugConfig, LogLevel, LogTransport } from './types';
import { parseDebugEnv } from './namespace';
import { createConsoleTransport } from './transports/console';

// ═══════════════════════════════════════════════════════════════════════════════
// Global Config
// ═══════════════════════════════════════════════════════════════════════════════

let globalConfig: DebugConfig | null = null;

function getDefaultConfig(): DebugConfig {
  const debug = process.env['DEBUG'];
  const { enabled, excluded } = parseDebugEnv(debug);
  
  const levelEnv = process.env['DEBUG_LEVEL']?.toLowerCase() as LogLevel | undefined;
  const level: LogLevel = levelEnv && ['error', 'warn', 'info', 'debug', 'trace'].includes(levelEnv)
    ? levelEnv
    : 'debug';
  
  const formatEnv = process.env['DEBUG_FORMAT']?.toLowerCase();
  const format: 'pretty' | 'json' = formatEnv === 'json' ? 'json' : 'pretty';
  
  const colors = process.env['DEBUG_COLORS'] !== 'false' && (process.stdout.isTTY ?? false);
  
  return {
    enabledPatterns: enabled,
    excludedPatterns: excluded,
    level,
    format,
    transports: [createConsoleTransport({ format, colors })],
    colors,
  };
}

/**
 * Get the global debug configuration.
 */
export function getConfig(): DebugConfig {
  if (!globalConfig) {
    globalConfig = getDefaultConfig();
  }
  return globalConfig;
}

/**
 * Configure the global debug settings.
 */
export function configure(options: Partial<DebugConfig>): void {
  const current = getConfig();
  globalConfig = { ...current, ...options };
}

/**
 * Add a transport to the global config.
 */
export function addTransport(transport: LogTransport): void {
  const config = getConfig();
  config.transports.push(transport);
}

/**
 * Reset configuration to defaults.
 */
export function resetConfig(): void {
  globalConfig = null;
}

/**
 * Enable specific namespaces programmatically.
 */
export function enable(patterns: string | string[]): void {
  const config = getConfig();
  const newPatterns = Array.isArray(patterns) ? patterns : [patterns];
  config.enabledPatterns = [...config.enabledPatterns, ...newPatterns];
}

/**
 * Disable specific namespaces programmatically.
 */
export function disable(patterns: string | string[]): void {
  const config = getConfig();
  const newPatterns = Array.isArray(patterns) ? patterns : [patterns];
  config.excludedPatterns = [...config.excludedPatterns, ...newPatterns];
}

/**
 * Flush all transports.
 */
export async function flush(): Promise<void> {
  const config = getConfig();
  await Promise.all(config.transports.map(t => t.flush?.()));
}

/**
 * Close all transports.
 */
export async function close(): Promise<void> {
  const config = getConfig();
  await Promise.all(config.transports.map(t => t.close?.()));
}

/**
 * @fileoverview Public API for @agntk/cli.
 * Re-exports key types and utilities for programmatic CLI usage.
 */

export { getVersion } from './version.js';
export { detectApiKey } from './config.js';
export { detectEnvironment, formatEnvironmentPrompt } from './environment.js';
export type { EnvironmentContext } from './environment.js';

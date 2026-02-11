/**
 * @fileoverview Public API for @agntk/cli.
 * Re-exports key types and utilities for programmatic CLI usage.
 */

export { getVersion } from './version.js';
export { parseArgs } from './args.js';
export type { ParsedArgs } from './args.js';
export { resolveConfig, detectApiKey, loadConfigFile } from './config.js';
export type { ResolvedCLIConfig } from './config.js';
export { detectEnvironment, formatEnvironmentPrompt } from './environment.js';
export type { EnvironmentContext } from './environment.js';
export { runOneShot, readStdin } from './runner.js';
export type { RunResult, RunOptions } from './runner.js';
export { runRepl } from './repl.js';
export type { ReplOptions, ReplResult } from './repl.js';

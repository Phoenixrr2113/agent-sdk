/**
 * @agntk/logger
 * 
 * Zero-dependency debug logging with namespace filtering, file output, and SSE support.
 * 
 * @example
 * ```typescript
 * import { createLogger, addTransport, createFileTransport } from '@agntk/logger';
 * 
 * // Enable via environment: DEBUG=@agntk/core:*
 * 
 * const log = createLogger('@agntk/core:agent');
 * log.info('Agent started', { role: 'coder' });
 * 
 * // Add file output
 * addTransport(createFileTransport({ path: './logs/agent.log' }));
 * 
 * // Timing
 * const done = log.time('llm-call');
 * await callLLM();
 * done(); // Logs with +123ms
 * ```
 */

// Types
export type {
  LogLevel,
  LogEntry,
  LogTransport,
  Logger,
  LoggerOptions,
  DebugConfig,
} from './types';

export { LOG_LEVELS } from './types';

// Core
export { createLogger, createNoopLogger } from './logger';

// Config
export {
  getConfig,
  configure,
  addTransport,
  resetConfig,
  enable,
  disable,
  flush,
  close,
  getLogEmitter,
} from './config';

// Transports
export {
  createConsoleTransport,
  createFileTransport,
  createSSETransport,
  type ConsoleTransportOptions,
  type FileTransportOptions,
  type SSETransportOptions,
  type SSETransport,
  type SSEClient,
} from './transports';

// Namespace utilities
export {
  parseDebugEnv,
  matchesPattern,
  isNamespaceEnabled,
  childNamespace,
} from './namespace';

// Formatters (for custom transports)
export {
  formatPretty,
  formatJSON,
  formatSSE,
} from './formatter';

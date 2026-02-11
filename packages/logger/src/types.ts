/**
 * @fileoverview Logger type definitions.
 * Zero-dependency debug logging with namespace filtering, file output, and SSE support.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// Log Levels
// ═══════════════════════════════════════════════════════════════════════════════

export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'trace';

export const LOG_LEVELS: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
  trace: 4,
};

// ═══════════════════════════════════════════════════════════════════════════════
// Log Entry
// ═══════════════════════════════════════════════════════════════════════════════

export interface LogEntry {
  /** ISO timestamp */
  timestamp: string;
  /** Logger namespace (e.g., "@agntk/core:agent") */
  namespace: string;
  /** Log level */
  level: LogLevel;
  /** Log message */
  message: string;
  /** Additional context data */
  data?: Record<string, unknown>;
  /** Duration in milliseconds (for timing) */
  durationMs?: number;
  /** Unique ID for this log entry (for SSE dedup) */
  id: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Transport Interface
// ═══════════════════════════════════════════════════════════════════════════════

export interface LogTransport {
  /** Transport name for identification */
  name: string;
  /** Write a log entry */
  write(entry: LogEntry): void;
  /** Flush pending writes (for buffered transports) */
  flush?(): Promise<void>;
  /** Close the transport */
  close?(): Promise<void>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Logger Interface
// ═══════════════════════════════════════════════════════════════════════════════

export interface Logger {
  /** Log an error */
  error(message: string, data?: Record<string, unknown>): void;
  /** Log a warning */
  warn(message: string, data?: Record<string, unknown>): void;
  /** Log info */
  info(message: string, data?: Record<string, unknown>): void;
  /** Log debug info */
  debug(message: string, data?: Record<string, unknown>): void;
  /** Log trace info (very verbose) */
  trace(message: string, data?: Record<string, unknown>): void;
  
  /** Create a child logger with additional context */
  child(context: Record<string, unknown>): Logger;
  
  /** Check if this logger is enabled */
  isEnabled(): boolean;
  
  /** Get the namespace */
  readonly namespace: string;
  
  /** Start a timer, returns a function to stop and log duration */
  time(label: string): () => void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Logger Options
// ═══════════════════════════════════════════════════════════════════════════════

export interface LoggerOptions {
  /** Minimum log level (default: 'debug') */
  level?: LogLevel;
  /** Inherit context from parent */
  inheritedContext?: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Global Config
// ═══════════════════════════════════════════════════════════════════════════════

export interface DebugConfig {
  /** Enabled namespace patterns (from DEBUG env var) */
  enabledPatterns: string[];
  /** Excluded namespace patterns (patterns starting with -) */
  excludedPatterns: string[];
  /** Minimum log level */
  level: LogLevel;
  /** Output format */
  format: 'pretty' | 'json';
  /** Global transports */
  transports: LogTransport[];
  /** Show colors in pretty format */
  colors: boolean;
}

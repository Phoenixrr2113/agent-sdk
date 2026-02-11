/**
 * @fileoverview Core logger factory.
 * 
 * Usage:
 * ```typescript
 * import { createLogger } from '@agntk/logger';
 * 
 * const log = createLogger('@agntk/core:agent');
 * 
 * log.info('Agent created', { agentId: '123' });
 * log.debug('Building tools', { preset: 'standard' });
 * 
 * // Timing
 * const done = log.time('tool-execution');
 * // ... do work ...
 * done(); // logs with durationMs
 * 
 * // Child logger with context
 * const runLog = log.child({ runId: 'run-123' });
 * runLog.info('Step completed'); // includes runId in data
 * ```
 */

import type { Logger, LoggerOptions, LogEntry, LogLevel } from './types';
import { LOG_LEVELS } from './types';
import { getConfig, emitLog } from './config';
import { isNamespaceEnabled } from './namespace';

// ═══════════════════════════════════════════════════════════════════════════════
// ID Generation
// ═══════════════════════════════════════════════════════════════════════════════

let idCounter = 0;

function generateId(): string {
  return `${Date.now().toString(36)}-${(idCounter++).toString(36)}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Logger Factory
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a logger for a specific namespace.
 */
export function createLogger(namespace: string, options: LoggerOptions = {}): Logger {
  const { level, inheritedContext = {} } = options;
  
  function isEnabled(): boolean {
    return isNamespaceEnabled(namespace, getConfig());
  }
  
  function shouldLog(entryLevel: LogLevel): boolean {
    if (!isEnabled()) return false;
    
    const config = getConfig();
    const minLevel = level ?? config.level;
    return LOG_LEVELS[entryLevel] <= LOG_LEVELS[minLevel];
  }
  
  function log(entryLevel: LogLevel, message: string, data?: Record<string, unknown>): void {
    if (!shouldLog(entryLevel)) return;
    
    const config = getConfig();
    
    const entry: LogEntry = {
      id: generateId(),
      timestamp: new Date().toISOString(),
      namespace,
      level: entryLevel,
      message,
      data: { ...inheritedContext, ...data },
    };
    
    // Clean up empty data
    if (entry.data && Object.keys(entry.data).length === 0) {
      delete entry.data;
    }
    
    // Write to all transports
    for (const transport of config.transports) {
      try {
        transport.write(entry);
      } catch (err) {
        // Don't let transport errors break the application
        console.error(`[@agntk/logger] Transport "${transport.name}" failed:`, err);
      }
    }

    // Emit for SSE streaming (dashboard log viewer)
    emitLog(entry);
  }
  
  const logger: Logger = {
    namespace,
    
    error: (message, data) => log('error', message, data),
    warn: (message, data) => log('warn', message, data),
    info: (message, data) => log('info', message, data),
    debug: (message, data) => log('debug', message, data),
    trace: (message, data) => log('trace', message, data),
    
    isEnabled,
    
    child(context: Record<string, unknown>): Logger {
      return createLogger(namespace, {
        ...options,
        inheritedContext: { ...inheritedContext, ...context },
      });
    },
    
    time(label: string): () => void {
      const start = performance.now();
      return () => {
        const durationMs = Math.round(performance.now() - start);
        
        if (!shouldLog('debug')) return;
        
        const config = getConfig();
        
        const entry: LogEntry = {
          id: generateId(),
          timestamp: new Date().toISOString(),
          namespace,
          level: 'debug',
          message: label,
          durationMs,
          data: inheritedContext,
        };
        
        if (entry.data && Object.keys(entry.data).length === 0) {
          delete entry.data;
        }
        
        for (const transport of config.transports) {
          try {
            transport.write(entry);
          } catch (_e: unknown) {
            // Ignore transport errors
          }
        }
      };
    },
  };
  
  return logger;
}

// ═══════════════════════════════════════════════════════════════════════════════
// No-op Logger
// ═══════════════════════════════════════════════════════════════════════════════

const noop = () => {};

/**
 * Create a no-op logger (for production when debugging is disabled).
 */
export function createNoopLogger(namespace: string): Logger {
  return {
    namespace,
    error: noop,
    warn: noop,
    info: noop,
    debug: noop,
    trace: noop,
    isEnabled: () => false,
    child: () => createNoopLogger(namespace),
    time: () => noop,
  };
}

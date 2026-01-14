/**
 * @fileoverview Console transport - writes to stdout/stderr.
 */

import type { LogTransport, LogEntry } from '../types';
import { formatPretty, formatJSON } from '../formatter';

export interface ConsoleTransportOptions {
  /** Output format */
  format?: 'pretty' | 'json';
  /** Use colors (default: true if TTY) */
  colors?: boolean;
}

export function createConsoleTransport(options: ConsoleTransportOptions = {}): LogTransport {
  const format = options.format ?? 'pretty';
  const colors = options.colors ?? (process.stdout.isTTY ?? false);
  
  return {
    name: 'console',
    
    write(entry: LogEntry): void {
      const line = format === 'json' 
        ? formatJSON(entry)
        : formatPretty(entry, colors);
      
      // Errors and warnings go to stderr
      if (entry.level === 'error' || entry.level === 'warn') {
        process.stderr.write(line + '\n');
      } else {
        process.stdout.write(line + '\n');
      }
    },
  };
}

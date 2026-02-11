/**
 * @fileoverview File transport - writes logs to a file.
 */

import { appendFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import type { LogTransport, LogEntry } from '../types';
import { formatJSON } from '../formatter';

export interface FileTransportOptions {
  /** Path to log file */
  path: string;
  /** Buffer size before flush (default: 1 for immediate writes) */
  bufferSize?: number;
}

export function createFileTransport(options: FileTransportOptions): LogTransport {
  const { path, bufferSize = 1 } = options;
  let buffer: LogEntry[] = [];
  let ensuredDir = false;
  
  function ensureDir(): void {
    if (ensuredDir) return;
    const dir = dirname(path);
    if (dir && dir !== '.' && !existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    ensuredDir = true;
  }
  
  function flushBuffer(): void {
    if (buffer.length === 0) return;
    
    ensureDir();
    
    const lines = buffer.map(entry => formatJSON(entry)).join('\n') + '\n';
    appendFileSync(path, lines);
    buffer = [];
  }
  
  return {
    name: 'file',
    
    write(entry: LogEntry): void {
      buffer.push(entry);
      
      if (buffer.length >= bufferSize) {
        // Sync write to ensure logs survive crashes
        try {
          flushBuffer();
        } catch (err) {
          console.error('[@agntk/logger] Failed to write to file:', err);
        }
      }
    },
    
    async flush(): Promise<void> {
      flushBuffer();
    },
    
    async close(): Promise<void> {
      flushBuffer();
    },
  };
}


/**
 * @fileoverview File transport - writes logs to a file.
 */

import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { LogTransport, LogEntry } from '../types';
import { formatJSON } from '../formatter';

export interface FileTransportOptions {
  /** Path to log file */
  path: string;
  /** Buffer size before flush (default: 10) */
  bufferSize?: number;
  /** Format (default: json for machine parsing) */
  format?: 'json' | 'jsonl';
}

export function createFileTransport(options: FileTransportOptions): LogTransport {
  const { path, bufferSize = 10 } = options;
  let buffer: LogEntry[] = [];
  let ensuredDir = false;
  
  async function ensureDir(): Promise<void> {
    if (ensuredDir) return;
    await mkdir(dirname(path), { recursive: true });
    ensuredDir = true;
  }
  
  async function flushBuffer(): Promise<void> {
    if (buffer.length === 0) return;
    
    await ensureDir();
    
    const lines = buffer.map(entry => formatJSON(entry)).join('\n') + '\n';
    await appendFile(path, lines);
    buffer = [];
  }
  
  return {
    name: 'file',
    
    write(entry: LogEntry): void {
      buffer.push(entry);
      
      if (buffer.length >= bufferSize) {
        // Fire and forget flush
        flushBuffer().catch(err => {
          console.error('[@agent/logger] Failed to write to file:', err);
        });
      }
    },
    
    async flush(): Promise<void> {
      await flushBuffer();
    },
    
    async close(): Promise<void> {
      await flushBuffer();
    },
  };
}

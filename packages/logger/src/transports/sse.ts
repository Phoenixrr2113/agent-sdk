/**
 * @fileoverview SSE transport - streams logs to HTTP clients.
 * 
 * Usage:
 * ```typescript
 * const sse = createSSETransport();
 * 
 * // In your HTTP handler:
 * app.get('/logs', (req, res) => {
 *   res.setHeader('Content-Type', 'text/event-stream');
 *   res.setHeader('Cache-Control', 'no-cache');
 *   res.setHeader('Connection', 'keep-alive');
 *   
 *   sse.addClient(res);
 *   req.on('close', () => sse.removeClient(res));
 * });
 * ```
 */

import type { LogTransport, LogEntry } from '../types';
import { formatSSE } from '../formatter';

export interface SSEClient {
  write(data: string): boolean;
}

export interface SSETransport extends LogTransport {
  /** Add a client connection */
  addClient(client: SSEClient): void;
  /** Remove a client connection */
  removeClient(client: SSEClient): void;
  /** Get number of connected clients */
  clientCount(): number;
}

export interface SSETransportOptions {
  /** Maximum entries to buffer for new clients (default: 100) */
  bufferSize?: number;
  /** Send buffered entries to new clients (default: true) */
  sendHistory?: boolean;
}

export function createSSETransport(options: SSETransportOptions = {}): SSETransport {
  const { bufferSize = 100, sendHistory = true } = options;
  const clients = new Set<SSEClient>();
  const buffer: LogEntry[] = [];
  
  return {
    name: 'sse',
    
    write(entry: LogEntry): void {
      // Buffer for new clients
      buffer.push(entry);
      if (buffer.length > bufferSize) {
        buffer.shift();
      }
      
      // Send to all connected clients
      const sseData = formatSSE(entry);
      for (const client of clients) {
        try {
          client.write(sseData);
        } catch (_e: unknown) {
          clients.delete(client);
        }
      }
    },

    addClient(client: SSEClient): void {
      clients.add(client);
      
      // Send history
      if (sendHistory && buffer.length > 0) {
        for (const entry of buffer) {
          try {
            client.write(formatSSE(entry));
          } catch (_e: unknown) {
            clients.delete(client);
            break;
          }
        }
      }
    },
    
    removeClient(client: SSEClient): void {
      clients.delete(client);
    },
    
    clientCount(): number {
      return clients.size;
    },
  };
}

// WebSocket client for streaming

import { createLogger } from '@agent/logger';
import { WebSocketError } from './errors';
import type { StreamingChatCallbacks, ChatMessage } from './types';

const log = createLogger('@agent/sdk-client:ws');

export interface WebSocketClientConfig {
  url: string;
  reconnect?: boolean;
  reconnectInterval?: number;
}

export class AgentWebSocketClient {
  private ws: WebSocket | null = null;
  private config: WebSocketClientConfig;

  constructor(config: WebSocketClientConfig) {
    this.config = config;
    log.debug('Created WebSocket client', { url: config.url });
  }

  connect(): Promise<void> {
    log.debug('Connecting');
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.config.url);
        this.ws.onopen = () => {
          log.info('Connected');
          resolve();
        };
        this.ws.onerror = () => {
          log.error('Connection failed');
          reject(new WebSocketError('Connection failed'));
        };
      } catch (error) {
        reject(new WebSocketError('Failed to create WebSocket'));
      }
    });
  }

  send(message: ChatMessage, callbacks: StreamingChatCallbacks): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new WebSocketError('WebSocket not connected');
    }
    log.debug('Sending message');
    this.ws.send(JSON.stringify(message));
    
    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'text-delta' && callbacks.onText) {
          callbacks.onText(data.text);
        } else if (data.type === 'complete' && callbacks.onComplete) {
          callbacks.onComplete();
        }
      } catch (e) {
        callbacks.onError?.(new Error('Failed to parse message'));
      }
    };
  }

  disconnect(): void {
    log.debug('Disconnecting');
    this.ws?.close();
    this.ws = null;
  }
}

// Main client combining HTTP and WebSocket

import { AgentHttpClient } from './http-client';
import { AgentWebSocketClient, type WebSocketCallbacks, type ConnectionState } from './websocket-client';
import type { ChatRequest, ChatResponse, ChatMessage } from './types';

export interface AgentClientOptions {
  baseUrl: string;
  useWebSocket?: boolean;
}

export class AgentClient {
  private httpClient: AgentHttpClient;
  private wsClient?: AgentWebSocketClient;

  constructor(options: AgentClientOptions) {
    this.httpClient = new AgentHttpClient(options.baseUrl);
    if (options.useWebSocket) {
      const wsUrl = options.baseUrl.replace(/^http/, 'ws') + '/ws';
      this.wsClient = new AgentWebSocketClient({ url: wsUrl });
    }
  }

  getHttpClient(): AgentHttpClient {
    return this.httpClient;
  }

  async generate(request: ChatRequest): Promise<ChatResponse> {
    return this.httpClient.generate(request);
  }

  async stream(message: ChatMessage, callbacks: WebSocketCallbacks): Promise<void> {
    if (!this.wsClient) {
      throw new Error('WebSocket not configured');
    }
    await this.wsClient.connect();
    this.wsClient.send(message, callbacks);
  }

  onConnectionStateChange(handler: (state: ConnectionState) => void): void {
    this.wsClient?.onConnectionStateChange(handler);
  }

  disconnect(): void {
    this.wsClient?.disconnect();
  }
}

// HTTP client for agent server

import { createLogger } from '@agent/logger';
import { ApiClientError } from './errors';
import type { ChatRequest, ChatResponse, SessionResponse, HistoryResponse } from './types';

const log = createLogger('@agent/sdk-client');

export class AgentHttpClient {
  constructor(private baseUrl: string) {
    log.debug('Created HTTP client', { baseUrl });
  }

  async generate(request: ChatRequest): Promise<ChatResponse> {
    log.debug('generate', { messageCount: request.messages?.length });
    const response = await fetch(`${this.baseUrl}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    if (!response.ok) {
      log.error('generate failed', { status: response.status });
      throw new ApiClientError('Generate failed', response.status);
    }
    return response.json();
  }

  async getSession(sessionId: string): Promise<SessionResponse> {
    log.debug('getSession', { sessionId });
    const response = await fetch(`${this.baseUrl}/sessions/${sessionId}`);
    if (!response.ok) {
      throw new ApiClientError('Session not found', response.status);
    }
    return response.json();
  }

  async getHistory(sessionId: string): Promise<HistoryResponse> {
    log.debug('getHistory', { sessionId });
    const response = await fetch(`${this.baseUrl}/sessions/${sessionId}/history`);
    if (!response.ok) {
      throw new ApiClientError('History not found', response.status);
    }
    return response.json();
  }
}

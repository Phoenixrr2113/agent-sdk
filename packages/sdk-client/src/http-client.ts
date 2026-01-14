// HTTP client for agent server

import { createLogger } from '@agent/logger';
import { ApiClientError } from './errors';
import type {
  ChatRequest,
  ChatResponse,
  SessionResponse,
  HistoryResponse,
  StreamEvent,
  GenerateStreamOptions,
} from './types';

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

  /**
   * Stream a generation request using Server-Sent Events.
   * Returns an AsyncGenerator that yields StreamEvents.
   *
   * @param request - Chat request with messages
   * @param options - Streaming options (signal for abort)
   * @returns AsyncGenerator yielding stream events
   *
   * @example
   * ```typescript
   * const controller = new AbortController();
   * setTimeout(() => controller.abort(), 30000); // 30s timeout
   *
   * for await (const event of client.generateStream(request, { signal: controller.signal })) {
   *   if (event.type === 'text-delta') {
   *     process.stdout.write(event.data as string);
   *   }
   * }
   * ```
   */
  async *generateStream(
    request: ChatRequest,
    options: GenerateStreamOptions = {}
  ): AsyncGenerator<StreamEvent> {
    log.debug('generateStream', { messageCount: request.messages?.length });

    const response = await fetch(`${this.baseUrl}/generate/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify(request),
      signal: options.signal,
    });

    if (!response.ok) {
      log.error('generateStream failed', { status: response.status });
      throw new ApiClientError('Generate stream failed', response.status);
    }

    if (!response.body) {
      throw new ApiClientError('No response body for stream', 500);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (!data || data === '[DONE]') continue;

          try {
            const event = JSON.parse(data) as StreamEvent;
            log.trace('Stream event', { type: event.type });
            yield event;
          } catch {
            log.warn('Failed to parse SSE data', { data });
          }
        }
      }

      // Handle any remaining buffer
      if (buffer.startsWith('data: ')) {
        const data = buffer.slice(6).trim();
        if (data && data !== '[DONE]') {
          try {
            yield JSON.parse(data) as StreamEvent;
          } catch {
            // Ignore parse errors on final chunk
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
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

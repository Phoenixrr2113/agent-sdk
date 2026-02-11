/**
 * @agntk/client - HTTP Client Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AgentHttpClient } from '../http-client';
import { ApiClientError } from '../errors';
import type { StreamEvent } from '../types';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('AgentHttpClient', () => {
  let client: AgentHttpClient;
  const baseUrl = 'http://localhost:3000';

  beforeEach(() => {
    client = new AgentHttpClient(baseUrl);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generate', () => {
    it('should send a generate request and return response', async () => {
      const mockResponse = {
        message: { role: 'assistant', content: 'Hello!' },
        sessionId: 'test-session',
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await client.generate({
        messages: [{ role: 'user', content: 'Hi' }],
      });

      expect(mockFetch).toHaveBeenCalledWith(`${baseUrl}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: 'Hi' }] }),
      });
      expect(result).toEqual(mockResponse);
    });

    it('should throw ApiClientError on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(
        client.generate({ messages: [{ role: 'user', content: 'Hi' }] })
      ).rejects.toThrow(ApiClientError);
    });
  });

  describe('generateStream', () => {
    it('should yield stream events from SSE response', async () => {
      const events: StreamEvent[] = [
        { type: 'text-delta', data: 'Hello' },
        { type: 'text-delta', data: ' World' },
        { type: 'complete', data: null },
      ];

      // Create a mock ReadableStream
      const encoder = new TextEncoder();
      const sseData = events
        .map((e) => `data: ${JSON.stringify(e)}\n\n`)
        .join('');

      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(sseData));
          controller.close();
        },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: stream,
        headers: new Headers(),
      });

      const received: StreamEvent[] = [];
      for await (const event of client.generateStream({
        messages: [{ role: 'user', content: 'Hi' }],
      })) {
        received.push(event);
      }

      expect(received).toHaveLength(3);
      expect(received[0]).toEqual({ type: 'text-delta', data: 'Hello' });
      expect(received[1]).toEqual({ type: 'text-delta', data: ' World' });
      expect(received[2]).toEqual({ type: 'complete', data: null });
    });

    it('should handle chunked SSE data', async () => {
      const encoder = new TextEncoder();

      // Simulate data coming in chunks (split mid-event)
      const chunk1 = 'data: {"type":"text-delta","data":"Hel';
      const chunk2 = 'lo"}\n\ndata: {"type":"complete","data":null}\n\n';

      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(chunk1));
          controller.enqueue(encoder.encode(chunk2));
          controller.close();
        },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: stream,
        headers: new Headers(),
      });

      const received: StreamEvent[] = [];
      for await (const event of client.generateStream({
        messages: [{ role: 'user', content: 'Hi' }],
      })) {
        received.push(event);
      }

      expect(received).toHaveLength(2);
      expect(received[0]).toEqual({ type: 'text-delta', data: 'Hello' });
    });

    it('should ignore [DONE] marker', async () => {
      const encoder = new TextEncoder();
      const sseData = `data: {"type":"text-delta","data":"Hi"}\n\ndata: [DONE]\n\n`;

      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(sseData));
          controller.close();
        },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: stream,
        headers: new Headers(),
      });

      const received: StreamEvent[] = [];
      for await (const event of client.generateStream({
        messages: [{ role: 'user', content: 'Hi' }],
      })) {
        received.push(event);
      }

      expect(received).toHaveLength(1);
      expect(received[0]).toEqual({ type: 'text-delta', data: 'Hi' });
    });

    it('should throw ApiClientError on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const generator = client.generateStream({
        messages: [{ role: 'user', content: 'Hi' }],
      });

      await expect(generator.next()).rejects.toThrow(ApiClientError);
    });

    it('should throw if no response body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: null,
      });

      const generator = client.generateStream({
        messages: [{ role: 'user', content: 'Hi' }],
      });

      await expect(generator.next()).rejects.toThrow('No response body');
    });

    it('should support abort signal', async () => {
      const controller = new AbortController();
      
      mockFetch.mockImplementationOnce(async (_url, options) => {
        // Check that signal was passed
        expect(options.signal).toBe(controller.signal);
        throw new DOMException('Aborted', 'AbortError');
      });

      const generator = client.generateStream(
        { messages: [{ role: 'user', content: 'Hi' }] },
        { signal: controller.signal }
      );

      await expect(generator.next()).rejects.toThrow('Aborted');
    });
  });

  describe('getSession', () => {
    it('should fetch session by id', async () => {
      const mockResponse = { sessionId: 'test-123' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await client.getSession('test-123');

      expect(mockFetch).toHaveBeenCalledWith(`${baseUrl}/sessions/test-123`);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getHistory', () => {
    it('should fetch session history', async () => {
      const mockResponse = {
        messages: [{ role: 'user', content: 'Hi' }],
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await client.getHistory('test-123');

      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/sessions/test-123/history`
      );
      expect(result).toEqual(mockResponse);
    });
  });
});

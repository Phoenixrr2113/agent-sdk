/**
 * @agntk/server - Resumable Streams Tests
 *
 * Tests for the resumable stream feature (SDK-STREAMS-007).
 * Verifies x-workflow-run-id header behavior and event replay.
 */

import { describe, it, expect, vi } from 'vitest';
import { createAgentRoutes } from '../routes';

describe('Resumable Streams', () => {
  describe('x-workflow-run-id header', () => {
    it('should return x-workflow-run-id header for durable agents', async () => {
      const mockDurableAgent = {
        generate: vi.fn().mockResolvedValue({
          text: 'Hello World',
          steps: [],
        }),
        stream: vi.fn(),
        workflowRunId: 'wf-run-123',
        isWorkflowActive: true,
      };

      const routes = createAgentRoutes({ agent: mockDurableAgent });

      const req = new Request('http://localhost/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Hello' }),
      });

      const res = await routes.fetch(req);
      expect(res.status).toBe(200);
      expect(res.headers.get('x-workflow-run-id')).toBe('wf-run-123');
    });

    it('should NOT return x-workflow-run-id for non-durable agents', async () => {
      const mockAgent = {
        generate: vi.fn().mockResolvedValue({
          text: 'Hello',
          steps: [],
        }),
        stream: vi.fn(),
      };

      const routes = createAgentRoutes({ agent: mockAgent });

      const req = new Request('http://localhost/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Hello' }),
      });

      const res = await routes.fetch(req);
      expect(res.status).toBe(200);
      expect(res.headers.get('x-workflow-run-id')).toBeNull();
    });
  });

  describe('stream buffering', () => {
    it('should buffer SSE events for durable agent streams', async () => {
      const mockDurableAgent = {
        generate: vi.fn().mockResolvedValue({
          text: 'Hi',
          steps: [],
        }),
        stream: vi.fn(),
        workflowRunId: 'wf-buffer-test',
        isWorkflowActive: true,
      };

      const routes = createAgentRoutes({ agent: mockDurableAgent });

      const req = new Request('http://localhost/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Hello' }),
      });

      const res = await routes.fetch(req);
      expect(res.status).toBe(200);

      // Read the full SSE response
      const text = await res.text();

      // Should contain event IDs (indicating buffering is active)
      expect(text).toContain('id:');
      expect(text).toContain('event: text-delta');
      expect(text).toContain('event: done');
    });
  });

  describe('stream reconnection', () => {
    it('should replay buffered events when reconnecting with run-id', async () => {
      const mockDurableAgent = {
        generate: vi.fn().mockResolvedValue({
          text: 'Hello World, this is a longer response for testing',
          steps: [],
        }),
        stream: vi.fn(),
        workflowRunId: 'wf-reconnect-test',
        isWorkflowActive: true,
      };

      const routes = createAgentRoutes({ agent: mockDurableAgent });

      // First request: establish the stream and buffer events
      const req1 = new Request('http://localhost/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Hello' }),
      });

      const res1 = await routes.fetch(req1);
      expect(res1.status).toBe(200);
      const firstResponse = await res1.text();

      // Extract event IDs from first response
      const eventIdMatches = firstResponse.match(/id:\s*([^\n]+)/g);
      expect(eventIdMatches).toBeTruthy();
      expect(eventIdMatches!.length).toBeGreaterThanOrEqual(2);

      // Extract the second event ID for partial replay
      const secondEventId = eventIdMatches![1].replace('id:', '').trim();

      // Second request: reconnect with run-id and last-event-id
      const req2 = new Request('http://localhost/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-workflow-run-id': 'wf-reconnect-test',
          'Last-Event-ID': secondEventId,
        },
        body: JSON.stringify({}),
      });

      const res2 = await routes.fetch(req2);
      expect(res2.status).toBe(200);

      const reconnectResponse = await res2.text();

      // The reconnect should replay events AFTER the second event ID
      // So it should have fewer events than the original
      const reconnectEventIds = reconnectResponse.match(/id:\s*([^\n]+)/g);
      expect(reconnectEventIds).toBeTruthy();
      // Original has more events; reconnect skips the first two
      expect(reconnectEventIds!.length).toBeLessThan(eventIdMatches!.length);
    });

    it('should replay all events when reconnecting without Last-Event-ID', async () => {
      const mockDurableAgent = {
        generate: vi.fn().mockResolvedValue({
          text: 'Test response for replay',
          steps: [],
        }),
        stream: vi.fn(),
        workflowRunId: 'wf-replay-all',
        isWorkflowActive: true,
      };

      const routes = createAgentRoutes({ agent: mockDurableAgent });

      // First: establish the stream
      const req1 = new Request('http://localhost/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Hello' }),
      });
      await routes.fetch(req1);

      // Second: reconnect without Last-Event-ID
      const req2 = new Request('http://localhost/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-workflow-run-id': 'wf-replay-all',
        },
        body: JSON.stringify({}),
      });

      const res2 = await routes.fetch(req2);
      expect(res2.status).toBe(200);

      const text = await res2.text();
      // Should contain all buffered events including text-delta
      expect(text).toContain('event: text-delta');
      // Should contain event IDs (replayed from buffer)
      expect(text).toContain('id:');
    });

    it('should handle reconnection for unknown run-id by starting new stream', async () => {
      const mockAgent = {
        generate: vi.fn().mockResolvedValue({
          text: 'Fresh',
          steps: [],
        }),
        stream: vi.fn(),
      };

      const routes = createAgentRoutes({ agent: mockAgent });

      const req = new Request('http://localhost/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-workflow-run-id': 'nonexistent-run',
        },
        body: JSON.stringify({ prompt: 'Hello' }),
      });

      const res = await routes.fetch(req);
      expect(res.status).toBe(200);

      const text = await res.text();
      expect(text).toContain('event: text-delta');
    });
  });

  describe('non-durable fallback', () => {
    it('should work normally for standard (non-durable) agents', async () => {
      const mockAgent = {
        generate: vi.fn().mockResolvedValue({
          text: 'Standard response',
          steps: [],
        }),
        stream: vi.fn(),
      };

      const routes = createAgentRoutes({ agent: mockAgent });

      const req = new Request('http://localhost/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Hello' }),
      });

      const res = await routes.fetch(req);
      expect(res.status).toBe(200);
      expect(res.headers.get('x-workflow-run-id')).toBeNull();

      const text = await res.text();
      expect(text).toContain('event: text-delta');
      expect(text).toContain('event: done');
      // Standard streams should NOT have event IDs
      expect(text).not.toContain('id:');
    });
  });
});

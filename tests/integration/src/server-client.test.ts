/**
 * @fileoverview Integration tests for server + client round-trip.
 * Starts a real HTTP server with a mock agent, verifies client → server → agent flow.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createAgent } from '@agent/sdk';
import { createAgentServer } from '@agent/sdk-server';
import { AgentHttpClient } from '@agent/sdk-client';
import { createMockModel } from './setup';

const TEST_PORT = 4567;
let serverStarted = false;

describe('Server + Client', () => {
  let server: ReturnType<typeof createAgentServer>;
  let client: AgentHttpClient;

  beforeAll(() => {
    const agent = createAgent({
      model: createMockModel('Hello from server agent!'),
      systemPrompt: 'You are a test agent running on a server.',
      toolPreset: 'none',
      maxSteps: 1,
    });

    server = createAgentServer({
      agent,
      port: TEST_PORT,
    });

    server.start();
    serverStarted = true;
    client = new AgentHttpClient(`http://localhost:${TEST_PORT}`);
  });

  afterAll(() => {
    // Node.js test runner will clean up the process
    // Hono serve() doesn't expose a close method directly
  });

  describe('Health endpoint', () => {
    it('should return status ok', async () => {
      const response = await fetch(`http://localhost:${TEST_PORT}/health`);
      expect(response.ok).toBe(true);

      const body = await response.json();
      expect(body.status).toBe('ok');
      expect(body.version).toBeDefined();
      expect(body.timestamp).toBeDefined();
    });
  });

  describe('POST /generate', () => {
    it('should generate text via the agent', async () => {
      const response = await fetch(`http://localhost:${TEST_PORT}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Say hello' }),
      });

      expect(response.ok).toBe(true);
      const body = await response.json();
      expect(body.text).toBe('Hello from server agent!');
      expect(body.success).toBe(true);
    });

    it('should return 400 when no prompt provided', async () => {
      const response = await fetch(`http://localhost:${TEST_PORT}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /stream', () => {
    it('should stream SSE events', async () => {
      const response = await fetch(`http://localhost:${TEST_PORT}/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify({ prompt: 'Say hello' }),
      });

      expect(response.ok).toBe(true);

      const text = await response.text();
      // SSE format: "event: text-delta\ndata: {...}\n\n"
      expect(text).toContain('event: text-delta');
      expect(text).toContain('event: done');
    });
  });

  describe('AgentHttpClient.generate()', () => {
    it('should round-trip through client → server → agent', async () => {
      const result = await client.generate({
        messages: [{ role: 'user', content: 'Say hello' }],
      });

      expect(result.text).toBe('Hello from server agent!');
      expect(result.success).toBe(true);
    });
  });

  describe('AgentHttpClient.generateStream()', () => {
    it('should stream events through client', async () => {
      const events: Array<{ type: string; [key: string]: unknown }> = [];

      for await (const event of client.generateStream({
        messages: [{ role: 'user', content: 'Say hello' }],
      })) {
        events.push(event);
      }

      expect(events.length).toBeGreaterThan(0);
      const textEvents = events.filter((e) => e.type === 'text-delta');
      expect(textEvents.length).toBeGreaterThan(0);
    });
  });
});

/**
 * @agent/sdk-server - HTTP Routes
 * Hono routes for agent HTTP API with SSE streaming
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { streamSSE } from 'hono/streaming';
import { createLogger, getLogEmitter } from '@agent/logger';
import { createLoggingMiddleware, createRateLimitMiddleware, createAuthMiddleware } from './middleware';
import { ConcurrencyQueue, QueueFullError, QueueTimeoutError } from './queue';
import { StreamEventBuffer } from './stream-buffer';
import type { AgentServerOptions, DurableAgentInstance } from './types';
import * as fs from 'node:fs';
import * as path from 'node:path';

const log = createLogger('@agent/sdk-server:routes');

/**
 * Chat message format
 */
interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Request body for generate endpoint
 */
interface GenerateRequest {
  prompt?: string;
  messages?: ChatMessage[];
  options?: {
    userId?: string;
    sessionId?: string;
    complexity?: 'simple' | 'complex';
    role?: 'coder' | 'researcher' | 'analyst';
    enabledTools?: string[];
    workspaceRoot?: string;
  };
}

/**
 * Request body for stream endpoint
 */
interface StreamRequest {
  prompt?: string;
  messages?: ChatMessage[];
  options?: GenerateRequest['options'];
}

/**
 * Create agent HTTP routes with Hono
 * 
 * @param serverOptions - Server configuration options
 * @returns Hono app with agent routes
 */
export function createAgentRoutes(serverOptions: AgentServerOptions = {}) {
  const app = new Hono();

  // Configure CORS
  const corsOrigin = serverOptions.corsOrigin ?? '*';
  app.use('/*', cors({
    origin: Array.isArray(corsOrigin) ? corsOrigin : corsOrigin,
    allowMethods: ['GET', 'POST', 'PUT', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'x-workflow-run-id', 'Last-Event-ID'],
    exposeHeaders: ['x-workflow-run-id'],
  }));

  // Configure Middleware
  app.use('*', createLoggingMiddleware());

  // Rate limiter shared instance (avoids creating separate maps per route)
  const rateLimiter = createRateLimitMiddleware({ windowMs: 60000, max: 100 });
  const authMiddleware = serverOptions.apiKey 
    ? createAuthMiddleware({ apiKey: serverOptions.apiKey }) 
    : null;

  // Apply rate limiting and auth to agent endpoints
  app.use('/generate', rateLimiter);
  app.use('/stream', rateLimiter);
  app.use('/chat', rateLimiter);

  if (authMiddleware) {
    app.use('/generate', authMiddleware);
    app.use('/stream', authMiddleware);
    app.use('/chat', authMiddleware);
  }

  // Create concurrency queue
  const queue = serverOptions.queue ? new ConcurrencyQueue(serverOptions.queue) : null;

  // Create stream event buffer for resumable streams
  const streamBuffer = new StreamEventBuffer(serverOptions.streamBuffer);

  // Queue stats endpoint
  app.get('/queue', (c) => c.json(queue?.getStats() ?? { active: 0, queued: 0, available: Infinity }));

  // Health check endpoint
  app.get('/health', (c) => c.json({ 
    status: 'ok', 
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  }));

  // ============================================================================
  // Dashboard Endpoints
  // ============================================================================

  // Status endpoint - agent info
  app.get('/status', (c) => {
    const agent = serverOptions.agent as {
      role?: string;
      tools?: { name: string }[];
      model?: string;
    } | undefined;

    return c.json({
      role: agent?.role ?? 'unknown',
      tools: agent?.tools?.map(t => t.name) ?? [],
      model: agent?.model ?? 'unknown',
      version: '0.1.0',
    });
  });

  // Config endpoint - GET
  app.get('/config', async (c) => {
    try {
      const configPath = serverOptions.configPath ?? path.join(process.cwd(), 'agent-sdk.config.yaml');
      if (!fs.existsSync(configPath)) {
        return c.text('# No config file found', 200);
      }
      const content = fs.readFileSync(configPath, 'utf-8');
      return c.text(content, 200, { 'Content-Type': 'text/yaml' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return c.json({ error: message }, 500);
    }
  });

  // Config endpoint - PUT
  app.put('/config', async (c) => {
    try {
      const configPath = serverOptions.configPath ?? path.join(process.cwd(), 'agent-sdk.config.yaml');
      const body = await c.req.text();
      fs.writeFileSync(configPath, body, 'utf-8');
      log.info('Config updated', { path: configPath });
      return c.json({ success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return c.json({ error: message }, 500);
    }
  });

  // Logs endpoint - SSE stream
  app.get('/logs', (c) => {
    return streamSSE(c, async (stream) => {
      const emitter = getLogEmitter();

      const handler = (logEntry: unknown) => {
        stream.writeSSE({ data: JSON.stringify(logEntry) });
      };

      emitter.on('log', handler);

      // Keep connection alive with heartbeat
      const heartbeat = setInterval(() => {
        stream.writeSSE({ event: 'heartbeat', data: '' });
      }, 30000);

      // Wait for client disconnect
      try {
        await new Promise((resolve) => {
          c.req.raw.signal.addEventListener('abort', resolve);
        });
      } finally {
        clearInterval(heartbeat);
        emitter.off('log', handler);
      }
    });
  });

  // ============================================================================
  // Agent Endpoints
  // ============================================================================

  // Generate endpoint - synchronous completion
  app.post('/generate', async (c) => {
    try {
      const body = await c.req.json<GenerateRequest>();
      
      const prompt = body.prompt ?? body.messages?.map(m => `${m.role}: ${m.content}`).join('\n') ?? '';
      
      if (!prompt) {
        return c.json({ error: 'prompt or messages is required' }, 400);
      }

      const agent = serverOptions.agent;
      if (!agent) {
        return c.json({ 
          error: 'Agent not configured. Provide agent or agentOptions to createAgentServer.',
        }, 500);
      }

      // Acquire queue slot
      if (queue) {
        try {
          await queue.acquire();
        } catch (error) {
          if (error instanceof QueueFullError) {
            return c.json({ error: error.message }, 503);
          }
          if (error instanceof QueueTimeoutError) {
            return c.json({ error: error.message }, 408);
          }
          throw error;
        }
      }

      const agentInstance = agent as { 
        generate: (opts: { prompt: string; options?: unknown }) => Promise<{ text: string; steps: unknown[] }>;
      };

      try {
        const result = await agentInstance.generate({
          prompt,
          options: body.options,
        });

        return c.json({
          text: result.text,
          steps: result.steps?.length ?? 0,
          success: true,
        });
      } finally {
        queue?.release();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return c.json({ error: message, success: false }, 500);
    }
  });

  // Stream endpoint - SSE streaming (uses generate internally, streams response)
  app.post('/stream', async (c) => {
    try {
      const body = await c.req.json<StreamRequest>();

      // Check for reconnection headers
      const reconnectRunId = c.req.header('x-workflow-run-id');
      const lastEventId = c.req.header('Last-Event-ID');

      // Handle reconnection: replay buffered events
      if (reconnectRunId && streamBuffer.has(reconnectRunId)) {
        log.info('Resumable stream reconnection', { runId: reconnectRunId, lastEventId });

        return streamSSE(c, async (stream) => {
          // Set the run-id header for client tracking
          c.header('x-workflow-run-id', reconnectRunId);

          const events = lastEventId
            ? streamBuffer.getEventsAfter(reconnectRunId, lastEventId)
            : streamBuffer.getAllEvents(reconnectRunId);

          log.info('Replaying buffered events', { runId: reconnectRunId, count: events.length });

          for (const buffered of events) {
            await stream.writeSSE({
              id: buffered.id,
              event: buffered.event,
              data: buffered.data,
            });
          }

          // If the run is complete, send done event
          if (streamBuffer.isCompleted(reconnectRunId)) {
            await stream.writeSSE({ event: 'done', data: '' });
          }
          // Otherwise, the stream stays open for live events
          // (in a production impl, this would subscribe to live updates)
        });
      }

      const prompt = body.prompt ?? body.messages?.map(m => `${m.role}: ${m.content}`).join('\n') ?? '';
      
      if (!prompt) {
        return c.json({ error: 'prompt or messages is required' }, 400);
      }

      const agent = serverOptions.agent;
      if (!agent) {
        return c.json({ 
          error: 'Agent not configured. Provide agent or agentOptions to createAgentServer.',
        }, 500);
      }

      // Duck-type check for durable agent
      const durableAgent = agent as DurableAgentInstance;
      const isDurable = typeof durableAgent.workflowRunId === 'string' || durableAgent.isWorkflowActive === true;
      const runId = isDurable ? (durableAgent.workflowRunId ?? crypto.randomUUID()) : undefined;

      const agentInstance = agent as {
        generate: (opts: { prompt: string; options?: unknown }) => Promise<{ text: string; steps?: unknown[] }>;
      };

      // Set run-id header if durable
      if (runId) {
        c.header('x-workflow-run-id', runId);
        log.info('Durable stream started', { runId });
      }

      return streamSSE(c, async (stream) => {
        try {
          const result = await agentInstance.generate({ 
            prompt, 
            options: body.options,
          });

          const text = result.text ?? '';

          // Stream text in chunks for smooth UX
          const chunkSize = 10;
          for (let i = 0; i < text.length; i += chunkSize) {
            const chunk = text.slice(i, i + chunkSize);
            const eventData = JSON.stringify({ type: 'text-delta', textDelta: chunk });
            const eventId = runId ? streamBuffer.store(runId, 'text-delta', eventData) : undefined;

            await stream.writeSSE({ 
              id: eventId,
              event: 'text-delta',
              data: eventData,
            });
            // Small delay for visual effect
            await new Promise(r => setTimeout(r, 20));
          }

          // Send final
          const doneData = JSON.stringify({ text, steps: result.steps?.length ?? 0 });
          if (runId) {
            streamBuffer.store(runId, 'done', doneData);
            streamBuffer.markCompleted(runId);
          }

          await stream.writeSSE({ 
            event: 'done', 
            data: doneData,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Stream error';
          log.error('Stream error', { error: message });
          const errorData = JSON.stringify({ error: message });
          if (runId) {
            streamBuffer.store(runId, 'error', errorData);
          }
          await stream.writeSSE({ 
            event: 'error', 
            data: errorData,
          });
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return c.json({ error: message }, 500);
    }
  });

  // Chat endpoint (stateful with session)
  app.post('/chat', async (c) => {
    try {
      const body = await c.req.json<StreamRequest & { sessionId?: string }>();
      
      const prompt = body.prompt ?? body.messages?.map(m => `${m.role}: ${m.content}`).join('\n') ?? '';
      
      if (!prompt) {
        return c.json({ error: 'prompt or messages is required' }, 400);
      }

      const agent = serverOptions.agent;
      if (!agent) {
        return c.json({ error: 'Agent not configured' }, 500);
      }

      const agentInstance = agent as {
        stream: (opts: { prompt: string; options?: unknown }) => {
          fullStream: AsyncIterable<{ type: string; [key: string]: unknown }>;
          text: Promise<string>;
        };
      };

      return streamSSE(c, async (stream) => {
        const response = agentInstance.stream({ 
          prompt, 
          options: { ...body.options, sessionId: body.sessionId },
        });

        for await (const chunk of response.fullStream) {
          await stream.writeSSE({ 
            event: chunk.type, 
            data: JSON.stringify(chunk),
          });
        }

        await stream.writeSSE({ event: 'done', data: '' });
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return c.json({ error: message }, 500);
    }
  });

  return app;
}

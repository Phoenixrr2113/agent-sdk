---
title: SDK Server
description: Hono-based HTTP server with REST, SSE, and WebSocket endpoints
---

# SDK Server (`@agntk/server`)

Hono-based HTTP server with REST, SSE streaming, and WebSocket endpoints.

## Basic Setup

```typescript
import { createAgentServer } from '@agntk/server';
import { createAgent } from '@agntk/core';

const agent = createAgent({
  role: 'coder',
  toolPreset: 'standard'
});

const server = createAgentServer({
  agent,
  port: 3001
});

server.start();
// Server running at http://localhost:3001
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check — returns `{ status: 'ok' }` |
| `GET` | `/status` | Server status with version info |
| `POST` | `/generate` | Synchronous generation |
| `POST` | `/stream` | SSE streaming generation |
| `POST` | `/hooks/:id/resume` | Resume a suspended workflow hook |
| `WS` | `/ws/browser-stream` | Real-time browser viewport streaming |

## Request Format

```typescript
// POST /generate or /stream
{
  "prompt": "What is 2+2?",
  // OR use messages array:
  "messages": [
    { "role": "user", "content": "What is 2+2?" }
  ],
  "sessionId": "optional-session-id"
}
```

## Server Options

```typescript
import { createAgentServer } from '@agntk/server';

const server = createAgentServer({
  agent,
  port: 3001,
  // Middleware is available but optional
});
```

## Example: Curl Requests

### Health Check

```bash
curl http://localhost:3001/health
```

### Synchronous Generation

```bash
curl -X POST http://localhost:3001/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What is 2+2?"}'
```

### Streaming Generation

```bash
curl -X POST http://localhost:3001/stream \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Tell me a story"}' \
  --no-buffer
```

## Next Steps

- [SDK Client](/packages/sdk-client) — Connect to this server from a client
- [SDK Core](/packages/sdk) — Learn about agent configuration


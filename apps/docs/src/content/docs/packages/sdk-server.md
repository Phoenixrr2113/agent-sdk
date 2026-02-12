---
title: "SDK Server"
description: "Hono HTTP server — REST + SSE + WebSocket endpoints"
---

Hono-based HTTP server with REST, SSE streaming, and WebSocket endpoints.

```typescript
import { createAgentServer } from '@agntk/server';
import { createAgent } from '@agntk/core';

const agent = createAgent({ role: 'coder', toolPreset: 'standard' });
const server = createAgentServer({ agent, port: 3000 });
server.start();
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/status` | Agent info (role, tools, model) |
| `GET` | `/queue` | Concurrency queue stats |
| `GET` | `/config` | Read config file |
| `PUT` | `/config` | Update config file |
| `GET` | `/logs` | SSE stream of log entries |
| `POST` | `/generate` | Synchronous generation |
| `POST` | `/stream` | SSE streaming generation |
| `POST` | `/chat` | SSE streaming via `agent.stream()` |
| `GET` | `/hooks` | List workflow hooks (filterable by status) |
| `GET` | `/hooks/:id` | Get specific hook details |
| `POST` | `/hooks/:id/resume` | Resume a suspended hook |
| `POST` | `/hooks/:id/reject` | Reject a suspended hook |
| `WS` | `/ws/browser-stream` | Real-time browser viewport streaming |

**Middleware**: CORS, body size limits (1MB), rate limiting (100 req/min on generation endpoints), optional API key auth, optional concurrency queue.

---

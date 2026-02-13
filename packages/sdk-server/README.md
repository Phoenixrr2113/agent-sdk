# @agntk/server

Hono-based HTTP server for [@agntk/core](https://www.npmjs.com/package/@agntk/core) agents. Exposes REST, SSE streaming, and WebSocket endpoints.

## Install

```bash
npm install @agntk/server @agntk/core
```

## Quick Start

```typescript
import { createAgentServer } from '@agntk/server';
import { createAgent } from '@agntk/core';

const agent = createAgent({ name: 'server-agent', instructions: 'You are a helpful assistant.' });
const server = createAgentServer({ agent, port: 3001 });
server.start();
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/status` | Agent info (name, tools, model) |
| `GET` | `/queue` | Concurrency queue stats |
| `GET` | `/config` | Read config file |
| `PUT` | `/config` | Update config file |
| `GET` | `/logs` | SSE stream of log entries |
| `POST` | `/generate` | Synchronous generation |
| `POST` | `/stream` | SSE streaming generation |
| `POST` | `/chat` | Stateful chat with SSE streaming |
| `GET` | `/hooks` | List workflow hooks (filterable by status) |
| `GET` | `/hooks/:id` | Get specific hook details |
| `POST` | `/hooks/:id/resume` | Resume a suspended workflow hook |
| `POST` | `/hooks/:id/reject` | Reject a suspended workflow hook |
| `WS` | `/ws/browser-stream` | Real-time browser viewport streaming |

## Documentation

See the [main repository](https://github.com/agntk/agntk) for full documentation.

## License

MIT

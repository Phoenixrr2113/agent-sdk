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

const agent = createAgent({ role: 'coder', toolPreset: 'standard' });
const server = createAgentServer({ agent, port: 3001 });
server.start();
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/status` | Server status with version info |
| `POST` | `/generate` | Synchronous generation |
| `POST` | `/stream` | SSE streaming generation |
| `POST` | `/hooks/:id/resume` | Resume a suspended workflow hook |
| `WS` | `/ws/browser-stream` | Real-time browser viewport streaming |

## Documentation

See the [main repository](https://github.com/agntk/agntk) for full documentation.

## License

MIT

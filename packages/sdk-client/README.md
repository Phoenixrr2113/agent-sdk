# @agntk/client

HTTP/WebSocket client for connecting to an [@agntk/server](https://www.npmjs.com/package/@agntk/server) instance.

## Install

```bash
npm install @agntk/client
```

## Quick Start

```typescript
import { AgentHttpClient } from '@agntk/client';

const client = new AgentHttpClient('http://localhost:3001');

// Synchronous
const result = await client.generate({
  messages: [{ role: 'user', content: 'Hello!' }],
});

// Streaming (SSE)
for await (const event of client.generateStream({
  messages: [{ role: 'user', content: 'Tell me a story' }],
})) {
  if (event.type === 'text-delta') process.stdout.write(event.textDelta);
}
```

## Features

- **HTTP Client** — Synchronous and streaming generation
- **SSE Streams** — Real-time text deltas, tool calls, and step events
- **WebSocket Client** — Full-duplex communication
- **Chat Client** — Session management with history
- **Browser Stream Client** — Real-time viewport streaming
- **Resumable Streams** — Reconnect from where you left off

## Documentation

See the [main repository](https://github.com/agntk/agntk) for full documentation.

## License

MIT

---
title: "SDK Client"
description: "Client library — HTTP, SSE streams, WebSocket, session management"
---

Client library for connecting to an Agent SDK server.

```typescript
import { AgentHttpClient } from '@agntk/client';

const client = new AgentHttpClient('http://localhost:3000');

// Synchronous generate
const result = await client.generate({
  messages: [{ role: 'user', content: 'Hello!' }],
});

// Streaming generate (SSE)
for await (const event of client.generateStream({
  messages: [{ role: 'user', content: 'Tell me a story' }],
})) {
  if (event.type === 'text-delta') {
    process.stdout.write(event.textDelta);
  }
}
```

**Available clients**: `AgentClient` (combined HTTP + WebSocket), `AgentHttpClient` (HTTP only), `ChatClient` (SSE with callbacks), `AgentWebSocketClient` (WebSocket with auto-reconnect), `BrowserStreamClient` (browser viewport streaming).

---

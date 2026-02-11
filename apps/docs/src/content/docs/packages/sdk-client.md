---
title: SDK Client
description: Client library for connecting to an Agent SDK server
---

# SDK Client (`@agntk/client`)

Client library for connecting to an Agent SDK server.

## Basic Setup

```typescript
import { AgentHttpClient } from '@agntk/client';

const client = new AgentHttpClient('http://localhost:3001');
```

## Synchronous Generation

```typescript
const result = await client.generate({
  messages: [{ role: 'user', content: 'Hello!' }],
});

console.log(result);
```

## Streaming Generation (SSE)

```typescript
for await (const event of client.generateStream({
  messages: [{ role: 'user', content: 'Tell me a story' }],
})) {
  if (event.type === 'text-delta') {
    process.stdout.write(event.textDelta);
  }
  if (event.type === 'finish') {
    console.log('\nDone:', event.text);
  }
}
```

## Stream Event Types

```typescript
type StreamEvent =
  | { type: 'text-delta'; textDelta: string }
  | { type: 'tool-call'; toolCallId: string; toolName: string; args: unknown }
  | { type: 'tool-result'; toolCallId: string; toolName: string; result: unknown }
  | { type: 'step-start'; stepIndex: number }
  | { type: 'step-finish'; stepIndex: number; finishReason: string }
  | { type: 'finish'; text: string; usage?: TokenUsage }
  | { type: 'error'; error: string };
```

## Resumable Streams

Streams support reconnection for durable agents:

```typescript
const gen = client.generateStream(request);

for await (const event of gen) {
  // Process events...
}

// After disconnect, get metadata for reconnection:
const metadata = client.lastStreamMetadata;

// Reconnect from where you left off:
const resumed = client.generateStream(request, {
  workflowRunId: metadata?.workflowRunId,
  lastEventId: metadata?.lastEventId,
});
```

## Other Clients

### Chat Client

High-level chat client with session management:

```typescript
import { ChatClient } from '@agntk/client';

const chat = new ChatClient(httpClient, { sessionId: 'abc' });
await chat.stream(request, {
  onTextDelta: (text) => console.log(text),
});
```

### WebSocket Client

Real-time communication:

```typescript
import { AgentWebSocketClient } from '@agntk/client';

const ws = new AgentWebSocketClient({
  url: 'ws://localhost:3001/ws'
});
```

### Browser Stream Client

Browser viewport streaming:

```typescript
import { BrowserStreamClient } from '@agntk/client';

const browser = new BrowserStreamClient({
  url: 'ws://localhost:3001/ws/browser-stream'
});
```

## Next Steps

- [SDK Server](/packages/sdk-server) — Set up a server to connect to
- [SDK Core](/packages/sdk) — Learn about agent configuration


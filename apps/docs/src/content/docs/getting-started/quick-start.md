---
title: Quick Start
description: Build your first agent in 5 minutes
---

# Quick Start

## Create Your First Agent

```typescript
import { createAgent } from '@agntk/core';

const agent = createAgent({
  role: 'coder',                // 'generic' | 'coder' | 'researcher' | 'analyst'
  toolPreset: 'standard',       // 'none' | 'minimal' | 'standard' | 'full'
  workspaceRoot: process.cwd(),
  maxSteps: 10,
});
```

## Synchronous Generation

Wait for the full response:

```typescript
const result = await agent.generate({
  prompt: 'Read package.json and list the dependencies'
});

console.log(result.text);
console.log(result.steps);  // Array of tool calls and results
```

## Streaming Generation

Get real-time updates as the agent works:

```typescript
const stream = await agent.stream({
  prompt: 'Explain this codebase'
});

for await (const chunk of stream.fullStream) {
  if (chunk.type === 'text-delta') {
    process.stdout.write(chunk.textDelta);
  }
}

// Or get the final text after consuming the stream:
const text = await stream.text;
```

## Stream Event Types

```typescript
type StreamEvent =
  | { type: 'text-delta'; textDelta: string }
  | { type: 'tool-call'; toolName: string }
  | { type: 'tool-result'; result: unknown }
  | { type: 'step-finish'; finishReason: string }
  | { type: 'finish'; text: string }
  | { type: 'error'; error: string };
```

## Next Steps

- [SDK Core](/packages/sdk) — Learn about roles, tools, and configuration
- [SDK Server](/packages/sdk-server) — Serve agents over HTTP
- [SDK Client](/packages/sdk-client) — Connect to a remote agent server


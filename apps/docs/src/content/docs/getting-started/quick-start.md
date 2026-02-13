---
title: Quick Start
description: Build your first agent with Agent SDK
---

# Quick Start

```bash
pnpm install
pnpm build
pnpm test
```

---

## Creating an Agent

```typescript
import { createAgent } from '@agntk/core';

const agent = createAgent({
  name: 'my-agent',
  instructions: 'You are a helpful coding assistant.',
  workspaceRoot: process.cwd(),
  maxSteps: 25,
});

const result = await agent.stream({ prompt: 'Read package.json and list the dependencies' });

for await (const chunk of result.fullStream) {
  if (chunk.type === 'text-delta') process.stdout.write(chunk.text ?? '');
}

const text = await result.text;
```

## Streaming

```typescript
const result = await agent.stream({ prompt: 'Build a REST API' });

for await (const chunk of result.fullStream) {
  switch (chunk.type) {
    case 'text-delta':    console.log(chunk.text); break;
    case 'tool-call':     console.log('Calling:', chunk.toolName); break;
    case 'tool-result':   console.log('Result:', chunk.result); break;
    case 'step-finish':   console.log('Step done'); break;
    case 'finish':        console.log('Complete'); break;
  }
}

const text = await result.text;
```


## Next Steps

- [SDK Core](/agntk/packages/sdk) — Full agent configuration reference
- [CLI](/agntk/packages/cli) — Use agents from the command line
- [Configuration](/agntk/configuration/yaml-config) — Configuration system

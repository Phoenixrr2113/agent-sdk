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
  role: 'coder',
  toolPreset: 'standard',
  workspaceRoot: process.cwd(),
  maxSteps: 10,
});

// Synchronous generation
const result = await agent.generate({ prompt: 'Read package.json and list the dependencies' });
console.log(result.text);
console.log(result.steps);

// Streaming generation
const stream = await agent.stream({ prompt: 'Explain this codebase' });

for await (const chunk of stream.fullStream) {
  if (chunk.type === 'text-delta') process.stdout.write(chunk.textDelta);
}

const text = await stream.text;
```

## Streaming

```typescript
const stream = await agent.stream({ prompt: 'Build a REST API' });

for await (const chunk of stream.fullStream) {
  switch (chunk.type) {
    case 'text-delta':    console.log(chunk.textDelta); break;
    case 'tool-call':     console.log('Calling:', chunk.toolName); break;
    case 'tool-result':   console.log('Result:', chunk.result); break;
    case 'step-finish':   console.log('Step done'); break;
    case 'finish':        console.log('Complete'); break;
  }
}

const text = await stream.text;
```


## Next Steps

- [SDK Core](/agntk/packages/sdk) — Full agent configuration reference
- [CLI](/agntk/packages/cli) — Use agents from the command line
- [Configuration](/agntk/configuration/yaml-config) — Configuration system

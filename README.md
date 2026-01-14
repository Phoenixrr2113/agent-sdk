# Agent SDK

A lightweight, portable SDK for building AI agents using the [Vercel AI SDK](https://ai-sdk.dev).

## Packages

| Package | Description |
|---------|-------------|
| `@agent/sdk` | Core agent factory, tools, and presets |
| `@agent/sdk-server` | Hono-based HTTP server with SSE streaming |
| `@agent/sdk-client` | Client library for connecting to SDK server |

## Quick Start

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test
```

## Usage

### Creating an Agent

```typescript
import { createAgent } from '@agent/sdk';

const agent = createAgent({
  role: 'coder',
  workspaceRoot: '/my/project',
  toolPreset: 'standard',
});

const result = await agent.generate({ prompt: 'Create a hello world function' });
console.log(result.text);
```

### Running a Server

```typescript
import { createAgentServer } from '@agent/sdk-server';
import { createAgent } from '@agent/sdk';

const agent = createAgent({ role: 'coder' });
const server = createAgentServer({ agent, port: 3001 });
server.start();
```

### Using the Client

```typescript
import { AgentClient } from '@agent/sdk-client';

const client = new AgentClient({ baseUrl: 'http://localhost:3001' });
const result = await client.generate({ prompt: 'Hello!' });
```

## Features

- **ToolLoopAgent** - Uses AI SDK's agent pattern
- **Tool Presets** - none, minimal, standard, full configurations
- **Role System** - coder, researcher, analyst, generic
- **Sub-Agent Spawning** - Hierarchical agent delegation
- **SSE Streaming** - Real-time response streaming
- **Memory Integration** - Vectra-based vector memory

## Requirements

- Node.js >= 18
- pnpm >= 9

## License

MIT

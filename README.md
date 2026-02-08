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
- **Durable Workflows** - Crash recovery, auto-retry, and step-level checkpointing
- **Workflow Hooks** - Human-in-the-loop approval with `defineHook()`
- **Resumable Streams** - Survive page refreshes and network disconnects

## Workflow Observability

Durable agents record every LLM call, tool execution, and webhook suspension as discrete workflow steps. Use the built-in inspector to debug agent runs step-by-step.

### Quick Start

```bash
# Launch the workflow inspector (opens web UI)
pnpm inspect
```

This runs `npx workflow inspect runs --web`, which opens a local web UI showing all workflow runs with their individual steps.

### What You'll See

Each durable agent run is broken into named steps visible in the inspector:

| Step Name | Description |
|-----------|-------------|
| `llmGenerate` | Standard LLM generation call |
| `llmDraft` | Draft generation (approval workflow) |
| `webhookApproval` | Webhook suspension point (zero compute) |
| `llmFinalize` | Final generation after approval |
| `durableSleep` | Durable delay (zero compute) |
| `tool-exec-{name}` | Individual tool executions (e.g. `tool-exec-read_file`) |

### Example: Durable Agent

```typescript
import { createAgent } from '@agent/sdk';

const agent = createAgent({
  role: 'coder',
  durable: true,
  toolPreset: 'standard',
});

// Every LLM call and tool execution is checkpointed.
// If the process crashes, it resumes from the last completed step.
const result = await agent.generate({ prompt: 'Refactor utils.ts' });
```

After running a durable agent, launch the inspector to see the step-by-step execution trace:

```bash
pnpm inspect
# Opens http://localhost:... with step timeline, inputs/outputs, and durations
```

### Direct CLI Usage

```bash
# List recent workflow runs
npx workflow inspect runs

# Open the web inspector
npx workflow inspect runs --web

# Inspect a specific run
npx workflow inspect run <run-id>
```

## Requirements

- Node.js >= 18
- pnpm >= 9

## License

MIT

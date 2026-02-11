---
title: Welcome
description: Agent SDK Documentation
---

# Agent SDK

A modular AI agent framework built on [Vercel AI SDK](https://ai-sdk.dev). Zero-config agents with real tools, durable workflows, knowledge graphs, and HTTP interfaces.

## What is Agent SDK?

Agent SDK provides a complete toolkit for building AI agents that can:

- **Execute tools** — shell commands, file operations, web browsing, and custom tools
- **Maintain durability** — crash recovery and auto-retry with Temporal-style workflows
- **Access knowledge** — FalkorDB-backed knowledge graphs with NLP entity extraction
- **Stream responses** — real-time text and tool execution events
- **Serve over HTTP** — REST, SSE, and WebSocket endpoints via Hono
- **Discover skills** — auto-inject SKILL.md files into agent prompts

## Quick Start

```typescript
import { createAgent } from '@agntk/core';

const agent = createAgent({
  role: 'coder',
  toolPreset: 'standard',
  workspaceRoot: process.cwd(),
});

const result = await agent.generate({
  prompt: 'Read package.json and list the dependencies'
});

console.log(result.text);
```

## Core Packages

| Package | Description |
|---------|-------------|
| `@agntk/core` | Core agent factory — tools, roles, config, streaming, durability, hooks, scheduling |
| `@agntk/server` | Hono HTTP server — REST + SSE + WebSocket endpoints |
| `@agntk/client` | Client library — HTTP, SSE streams, WebSocket, session management |
| `@agntk/logger` | Structured logging — namespace filtering, file/SSE transports, formatters |
| `@agntk/brain` | Knowledge graph — FalkorDB, code parsing, NLP entity extraction |

## Documentation

- **[Getting Started](/getting-started/introduction)** — Introduction and setup
- **[Installation](/getting-started/installation)** — Install Agent SDK
- **[Quick Start](/getting-started/quick-start)** — Build your first agent
- **[SDK Core](/packages/sdk)** — Learn about agents, tools, and configuration
- **[SDK Server](/packages/sdk-server)** — Serve agents over HTTP
- **[SDK Client](/packages/sdk-client)** — Connect to a remote agent server
- **[Logger](/packages/logger)** — Structured logging
- **[Brain](/packages/brain)** — Knowledge graph
- **[Configuration](/configuration/yaml-config)** — YAML configuration system

## Requirements

- Node.js >= 18
- pnpm >= 9
- FalkorDB (optional, for `@agntk/brain`)
- Temporal (optional, for durable workflows)

## License

MIT


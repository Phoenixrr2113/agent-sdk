---
title: Introduction
description: Welcome to Agent SDK — a modular AI agent framework
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

## Core Packages

| Package | Description |
|---------|-------------|
| `@agntk/core` | Core agent factory — tools, roles, config, streaming, durability, hooks, scheduling |
| `@agntk/server` | Hono HTTP server — REST + SSE + WebSocket endpoints |
| `@agntk/client` | Client library — HTTP, SSE streams, WebSocket, session management |
| `@agntk/logger` | Structured logging — namespace filtering, file/SSE transports, formatters |
| `@agntk/brain` | Knowledge graph — FalkorDB, code parsing, NLP entity extraction |

## Quick Example

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
console.log(result.steps); // Array of tool calls and results
```

## Next Steps

- [Installation](/getting-started/installation) — Set up Agent SDK in your project
- [Quick Start](/getting-started/quick-start) — Build your first agent
- [SDK Core](/packages/sdk) — Learn about agents, tools, and configuration


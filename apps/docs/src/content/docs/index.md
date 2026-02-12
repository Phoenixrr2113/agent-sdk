---
title: Welcome
description: Agent SDK Documentation
template: splash
hero:
  title: Agent SDK
  tagline: A modular AI agent framework built on Vercel AI SDK. Zero-config agents with real tools, durable workflows, knowledge graphs, and HTTP interfaces.
  image:
    dark: ../../assets/logo-dark.svg
    light: ../../assets/logo-light.svg
  actions:
    - text: Get Started
      link: /agntk/getting-started/introduction
      icon: right-arrow
    - text: View on GitHub
      link: https://github.com/Phoenixrr2113/agntk
      icon: external
      variant: minimal
---

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
| `@agntk/core` | Core agent factory -- tools, roles, config, streaming, durability, hooks, scheduling |
| `@agntk/cli` | CLI agent -- one-shot prompts, interactive REPL, persistent memory |
| `@agntk/server` | Hono HTTP server -- REST + SSE + WebSocket endpoints |
| `@agntk/client` | Client library -- HTTP, SSE streams, WebSocket, session management |
| `@agntk/logger` | Structured logging -- namespace filtering, file/SSE transports, formatters |
| `@agntk/brain` | Knowledge graph -- FalkorDB, code parsing, NLP entity extraction |

## Explore the Docs

- **[Introduction](/agntk/getting-started/introduction)** -- What Agent SDK is and why
- **[Installation](/agntk/getting-started/installation)** -- Get set up in minutes
- **[Quick Start](/agntk/getting-started/quick-start)** -- Build your first agent
- **[SDK Core](/agntk/packages/sdk)** -- Agents, tools, and configuration
- **[Server](/agntk/packages/sdk-server)** -- Serve agents over HTTP
- **[Client](/agntk/packages/sdk-client)** -- Connect to remote agents
- **[Logger](/agntk/packages/logger)** -- Structured logging
- **[Brain](/agntk/packages/brain)** -- Knowledge graph
- **[Config](/agntk/configuration/yaml-config)** -- YAML configuration system

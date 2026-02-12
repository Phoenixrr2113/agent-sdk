---
title: Welcome
description: Agent SDK Documentation
---

# Agent SDK

A modular AI agent framework built on [Vercel AI SDK](https://ai-sdk.dev). Zero-config agents with real tools, durable workflows, and HTTP interfaces.

## Packages

| Package | Description |
|---------|-------------|
| `@agntk/core` | Core agent factory — tools, roles, config, streaming, durability, hooks, scheduling |
| `@agntk/cli` | CLI agent — one-shot prompts, interactive REPL, persistent memory |
| `agntk` | Thin CLI wrapper — enables `npx agntk` usage |
| `@agntk/server` | Hono HTTP server — REST + SSE + WebSocket endpoints |
| `@agntk/client` | Client library — HTTP, SSE streams, WebSocket, session management |
| `@agntk/logger` | Structured logging — namespace filtering, file/SSE transports, formatters |

## Quick Start

```bash
pnpm install
pnpm build
pnpm test
```

---

## Documentation

- **[Getting Started](/agntk/getting-started/introduction)** — Introduction and setup
- **[Installation](/agntk/getting-started/installation)** — Install Agent SDK
- **[Quick Start](/agntk/getting-started/quick-start)** — Build your first agent
- **[SDK Core](/agntk/packages/sdk)** — Agents, tools, and configuration
- **[CLI](/agntk/packages/cli)** — Command-line interface
- **[SDK Server](/agntk/packages/sdk-server)** — Serve agents over HTTP
- **[SDK Client](/agntk/packages/sdk-client)** — Connect to a remote agent server
- **[Logger](/agntk/packages/logger)** — Structured logging
- **[Configuration](/agntk/configuration/yaml-config)** — Configuration system

## Requirements

- Node.js >= 20
- pnpm >= 9
- Workflow DevKit (optional, for durable workflows)
- Langfuse + @vercel/otel (optional, for observability)

## License

MIT

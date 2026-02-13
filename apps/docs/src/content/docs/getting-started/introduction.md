---
title: Introduction
description: Welcome to Agent SDK — a modular AI agent framework
---

# Agent SDK

A modular AI agent framework built on [Vercel AI SDK](https://ai-sdk.dev). Zero-config agents with real tools, durable workflows, and HTTP interfaces.

## Core Packages

| Package | Description |
|---------|-------------|
| `@agntk/core` | Core agent factory — tools, streaming, memory, sub-agents, durability, hooks, scheduling |
| `@agntk/cli` | CLI agent — one-shot prompts, interactive REPL, persistent memory |
| `agntk` | Thin CLI wrapper — enables `npx agntk` usage |
| `@agntk/server` | Hono HTTP server — REST + SSE + WebSocket endpoints |
| `@agntk/client` | Client library — HTTP, SSE streams, WebSocket, session management |
| `@agntk/logger` | Structured logging — namespace filtering, file/SSE transports, formatters |

## Next Steps

- [Installation](/agntk/getting-started/installation) — Set up Agent SDK in your project
- [Quick Start](/agntk/getting-started/quick-start) — Build your first agent
- [SDK Core](/agntk/packages/sdk) — Learn about agents, tools, and configuration

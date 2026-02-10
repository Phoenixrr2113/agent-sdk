---
title: Installation
description: Install Agent SDK in your project
---

# Installation

## Prerequisites

- **Node.js** >= 18
- **pnpm** >= 9 (or npm/yarn)

## Install from Monorepo

If you're working in the `agent-sdk` monorepo:

```bash
pnpm install
pnpm build
pnpm test
```

## Run Integration Tests

The demo app includes end-to-end tests that exercise all packages with real LLM calls:

```bash
pnpm --filter demo integration
```

## Project Structure

```
agent-sdk/
├── packages/
│   ├── sdk/           # @agent/sdk — Core agent factory
│   ├── sdk-server/    # @agent/sdk-server — HTTP server
│   ├── sdk-client/    # @agent/sdk-client — Client library
│   ├── logger/        # @agent/logger — Structured logging
│   └── brain/         # @agent/brain — Knowledge graph
├── apps/
│   ├── demo/          # Integration tests and demos
│   └── docs/          # Documentation site
└── agent-sdk.config.yaml
```

## Optional Dependencies

### FalkorDB (for Knowledge Graph)

If you plan to use `@agent/brain`, you'll need FalkorDB running locally:

```bash
docker run -p 6379:6379 falkordb/falkordb
```

### Temporal (for Durable Workflows)

For production durable workflows, set up a Temporal server. See the [Durable Agents](/packages/sdk#durable-agents) guide for details.

## Next Steps

- [Quick Start](/getting-started/quick-start) — Build your first agent
- [SDK Core](/packages/sdk) — Learn about agents and tools


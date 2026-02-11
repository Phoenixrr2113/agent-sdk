---
title: SDK Core
description: Core agent factory with tools, roles, and configuration
---

# SDK Core (`@agntk/core`)

The core agent factory provides tools, roles, configuration, streaming, durability, hooks, and scheduling.

## Creating an Agent

```typescript
import { createAgent } from '@agntk/core';

const agent = createAgent({
  role: 'coder',
  toolPreset: 'standard',
  workspaceRoot: process.cwd(),
  maxSteps: 10,
});
```

## Agent Options

```typescript
const agent = createAgent({
  // Identity
  role: 'coder',
  systemPrompt: 'You are...',
  agentId: 'my-agent-1',

  // Model
  model: myModelInstance,
  modelProvider: 'openrouter',
  modelName: 'gpt-4o',

  // Tools
  toolPreset: 'standard',
  tools: { myTool: ... },
  enableTools: ['shell'],
  disableTools: ['browser'],

  // Execution
  maxSteps: 10,
  stopWhen: (ctx) => false,

  // Sub-Agents
  enableSubAgents: true,
  maxSpawnDepth: 2,

  // Durability
  durable: true,
  workflowOptions: {
    defaultRetryCount: 3,
    defaultTimeout: '5m',
  },

  // Memory
  enableMemory: true,
  memoryOptions: {
    path: './memory-index',
    topK: 5,
    similarityThreshold: 0.7,
  },

  // Skills
  skills: {
    directories: ['.agents/skills'],
  },

  // Streaming
  enableTransientStreaming: true,

  // Callbacks
  onStepFinish: (step, i) => {},
  onEvent: (event) => {},
  askUserHandler: async (q) => prompt(q),
});
```

## Tool Presets

| Preset | Tools |
|--------|-------|
| `none` | No tools |
| `minimal` | `glob` |
| `standard` | `glob`, `grep`, `shell`, `plan`, `deep_reasoning` |
| `full` | `glob`, `grep`, `shell`, `plan`, `deep_reasoning`, `ast_grep_search`, `ast_grep_replace`, `browser` |

Custom tools are merged with the preset:

```typescript
const agent = createAgent({
  toolPreset: 'standard',
  tools: { myCustomTool },
  disableTools: ['shell'],
});
```

## Roles

Each role provides a tuned system prompt and recommended model tier:

| Role | Model Tier | Description |
|------|-----------|-------------|
| `generic` | standard | General-purpose assistant |
| `coder` | powerful | Software engineering |
| `researcher` | standard | Information gathering |
| `analyst` | standard | Data analysis |

## Configuration

The SDK uses a cascading config system:

1. **YAML file** — `agent-sdk.config.yaml`
2. **Programmatic** — `configure()` at runtime
3. **Defaults** — built-in fallbacks

```typescript
import { loadConfig, configure, getConfig, resolveModel } from '@agntk/core';

const config = loadConfig('./agent-sdk.config.yaml');
configure({ models: { defaultProvider: 'anthropic' } });
const model = resolveModel({ tier: 'powerful' });
```

## Model Tiers

| Tier | Purpose | Example |
|------|---------|---------|
| `fast` | Quick responses | Gemini Flash, GPT-4o-mini |
| `standard` | Balanced | Gemini Flash, Claude Haiku |
| `reasoning` | Complex logic | Claude Sonnet, o1-mini |
| `powerful` | Best quality | Claude Opus, GPT-4o |

## Durable Agents

Wrap agents in Temporal-style workflows for crash recovery:

```typescript
const agent = createAgent({
  role: 'coder',
  durable: true,
  toolPreset: 'standard',
});

const result = await agent.durableGenerate('Complex task');
const approved = await agent.withApproval('Deploy?');
agent.scheduled('1h', async () => { /* health check */ });
```

## Workflow Hooks

Human-in-the-loop approval with typed hooks:

```typescript
import { defineHook } from '@agntk/core';

const approvalHook = defineHook<{ amount: number }, boolean>({
  name: 'purchase-approval',
  description: 'Approve large purchases',
  timeout: '30m',
  defaultValue: false,
});

const approved = await approvalHook.wait({ amount: 5000 });
```

## Scheduled Workflows

Recurring tasks with zero-compute sleep:

```typescript
import { createScheduledWorkflow } from '@agntk/core';

const schedule = createScheduledWorkflow({
  name: 'daily-check',
  interval: '1h',
  task: async (iteration) => `Check #${iteration}`,
  onTick: (result, i) => console.log(result),
  maxIterations: 24,
});

await schedule.start();
```

## Skills

Auto-discover and inject SKILL.md files:

```typescript
import { createAgent, discoverSkills } from '@agntk/core';

const agent = createAgent({
  skills: { directories: ['.agents/skills'] },
});

const skills = await discoverSkills('./.agents/skills');
```

## Observability

Optional Langfuse integration for tracing:

```typescript
import { initObservability } from '@agntk/core';

initObservability({
  langfuse: { publicKey: '...', secretKey: '...' },
});
```


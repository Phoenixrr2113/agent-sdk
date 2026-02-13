---
title: "SDK Core"
description: "Core agent factory — tools, streaming, memory, sub-agents, durability, hooks"
---

## Creating an Agent

```typescript
import { createAgent } from '@agntk/core';

const agent = createAgent({
  name: 'my-agent',
  instructions: 'You are a helpful coding assistant.',
  workspaceRoot: process.cwd(),
  maxSteps: 25,
});

const result = await agent.stream({ prompt: 'Read package.json and list the dependencies' });

for await (const chunk of result.fullStream) {
  if (chunk.type === 'text-delta') process.stdout.write(chunk.text ?? '');
}

const text = await result.text;
```

## Agent Interface

```typescript
interface Agent {
  readonly name: string;
  init(): Promise<void>;              // Loads memory context, initializes telemetry
  stream(input: { prompt: string }): Promise<AgentStreamResult>;
  getSystemPrompt(): string;
  getToolNames(): string[];
}

interface AgentStreamResult {
  fullStream: AsyncIterable<StreamChunk>;   // All event types
  text: PromiseLike<string>;                // Final accumulated text
  usage: PromiseLike<LanguageModelUsage>;   // Token usage
}
```

`init()` is called automatically by `stream()` on first use.

## `AgentOptions` Reference

```typescript
const agent = createAgent({
  // ── Identity ──────────────────────────────────────────────
  name: 'deploy-bot',                // Display name (required) — used in logs, traces, memory
  instructions: 'You manage...',     // Natural language context injected as system prompt

  // ── Model ─────────────────────────────────────────────────
  model: myModelInstance,            // AI SDK LanguageModel (optional override)
  // Most users don't need this — the agent auto-selects the best available model

  // ── Tools ─────────────────────────────────────────────────
  tools: { myTool: ... },           // Custom tools (merged with built-in tools)

  // ── Execution ─────────────────────────────────────────────
  maxSteps: 25,                      // Max tool-loop iterations (default: 25)
  usageLimits: {                     // Token and request caps
    maxRequests: 20,
    maxTotalTokens: 100_000,
  },

  // ── Environment ───────────────────────────────────────────
  workspaceRoot: process.cwd(),      // Root for file operations
});
```

## Built-in Tools

Every agent comes with a full set of 20 built-in tools:

| Category | Tools |
|----------|-------|
| **Files** | `file_read`, `file_write`, `file_edit`, `file_create`, `glob`, `grep` |
| **Code** | `ast_grep_search`, `ast_grep_replace` |
| **Shell** | `shell`, `background` |
| **Planning** | `plan`, `deep_reasoning` |
| **Memory** | `remember`, `recall`, `update_context`, `forget` |
| **Sub-Agents** | `spawn_agent` |
| **Skills** | `search_skills` |
| **Progress** | `progress_read`, `progress_update` |
| **Browser** | `browser` |

Custom tools are merged with the built-in set:

```typescript
const agent = createAgent({
  name: 'my-agent',
  tools: { myCustomTool },
});
```

## Streaming

```typescript
const result = await agent.stream({ prompt: 'Build a REST API' });

for await (const chunk of result.fullStream) {
  switch (chunk.type) {
    case 'text-delta':    console.log(chunk.text); break;
    case 'tool-call':     console.log('Calling:', chunk.toolName); break;
    case 'tool-result':   console.log('Result:', chunk.result); break;
    case 'step-finish':   console.log('Step done'); break;
    case 'finish':        console.log('Complete'); break;
  }
}

const text = await result.text;
```

## Configuration

The SDK uses a cascading config system (highest priority first):

1. **Environment variables** — `AGENT_SDK_MODEL_FAST`, `AGENT_SDK_DEFAULT_PROVIDER`, etc.
2. **Config file** — `agent-sdk.config.yaml`, `.agent-sdk.json`, etc.
3. **Programmatic** — `configure()` at runtime
4. **Defaults** — built-in fallbacks

Config file discovery order: `AGENT_SDK_CONFIG` env var > `agent-sdk.config.yaml` > `agent-sdk.config.yml` > `agent-sdk.config.json` > `.agent-sdk.yaml` > `.agent-sdk.json`

```json
{
  "models": {
    "defaultProvider": "openrouter",
    "tiers": {
      "fast": "x-ai/grok-4.1-fast",
      "standard": "google/gemini-3-flash-preview",
      "reasoning": "deepseek/deepseek-r1",
      "powerful": "z-ai/glm-4.7"
    },
    "customProviders": {
      "my-provider": {
        "baseURL": "https://api.example.com/v1",
        "apiKeyEnv": "MY_PROVIDER_API_KEY"
      }
    }
  },
  "tools": {
    "shell": { "timeout": 30000 },
    "glob": { "maxFiles": 100 }
  },
  "maxSteps": 25
}
```

```typescript
import { loadConfig, configure, resolveModel } from '@agntk/core';

const config = loadConfig('./agent-sdk.config.json');

configure({ models: { defaultProvider: 'openrouter' } });

const model = resolveModel({ tier: 'powerful' });
const fastModel = resolveModel({ tier: 'fast', provider: 'openrouter' });
```

## Providers

All providers use `@ai-sdk/openai-compatible` for unified access:

| Provider | Default | Description |
|----------|---------|-------------|
| `openrouter` | Yes | Routes to any model — Anthropic, Google, Meta, etc. |
| `openai` | | Direct OpenAI API |
| `ollama` | | Local models via Ollama |
| Custom | | Any OpenAI-compatible API via `customProviders` config |

```bash
# Primary (recommended)
export OPENROUTER_API_KEY=sk-or-...

# Or use OpenAI directly
export OPENAI_API_KEY=sk-...

# For local models
export OLLAMA_ENABLED=true
```

## Model Tiers

| Tier | Purpose | OpenRouter Default |
|------|---------|-------------------|
| `fast` | Quick responses, low cost | `x-ai/grok-4.1-fast` |
| `standard` | Balanced quality/cost | `google/gemini-3-flash-preview` |
| `reasoning` | Complex logic, planning | `deepseek/deepseek-r1` |
| `powerful` | Best quality, highest cost | `z-ai/glm-4.7` |

Override per-tier via environment variables: `AGENT_SDK_MODEL_FAST`, `AGENT_SDK_MODEL_STANDARD`, `AGENT_SDK_MODEL_REASONING`, `AGENT_SDK_MODEL_POWERFUL`.

## Memory

Markdown-file-based persistent memory is always enabled. State is stored at `~/.agntk/agents/{name}/`:

```typescript
const agent = createAgent({ name: 'my-agent' });
// Memory tools are always available: remember, recall, update_context, forget
// Memory context is auto-loaded into the system prompt on first stream()
```

**Memory files**:

| File | Scope | Description |
|------|-------|-------------|
| `identity.md` | Global | Human-authored identity |
| `preferences.md` | Global | Agent-curated cross-project preferences |
| `project.md` | Project | Human-authored project context (falls back to `CLAUDE.md`, `AGENTS.md`) |
| `memory.md` | Project | Agent-curated facts |
| `context.md` | Project | Agent-rewritten session context |
| `decisions.md` | Project | Append-only decision log |

## Skills

Auto-discover `SKILL.md` files and inject into the agent's system prompt:

```typescript
const agent = createAgent({
  name: 'my-agent',
  // Skills are auto-discovered from default directories
});
```

Default discovery directories: `.claude/skills`, `.cursor/skills`, `.agents/skills`, `skills`

Skills support YAML frontmatter with `name`, `description`, `tags`, `when_to_use`, `requires-binaries`, `requires-env`, and more. Eligibility filtering checks that required binaries and env vars are present.

## Sub-Agents

Sub-agent spawning is always available via the `spawn_agent` tool:

```typescript
const agent = createAgent({
  name: 'coordinator',
  instructions: 'You coordinate work across specialized sub-agents.',
});

// The agent can use spawn_agent to delegate tasks to sub-agents with roles:
// coder, researcher, analyst, generic
```

## Durable Agents

Wrap tools with Workflow DevKit step directives for crash recovery:

```typescript
// Durability is auto-enabled when the workflow package is available
// Requires the `workflow` package (optional peer dependency)
```

## Workflow Hooks

Human-in-the-loop approval with typed hooks:

```typescript
import { defineHook, getHookRegistry } from '@agntk/core/advanced';

const approvalHook = defineHook<{ amount: number }, boolean>({
  name: 'purchase-approval',
  description: 'Approve large purchases',
  timeout: '30m',
  defaultValue: false,
});

const approved = await approvalHook.wait({ amount: 5000 });
```

## Duration Utilities

```typescript
import { parseDuration, formatDuration } from '@agntk/core/advanced';

parseDuration('2h');      // 7200000 (ms)
formatDuration(7200000);  // "2h"
```

## Sub-Path Exports

Advanced features are available via sub-path imports:

```typescript
import { ... } from '@agntk/core';           // Core essentials
import { ... } from '@agntk/core/evals';      // Eval suite and assertions
import { ... } from '@agntk/core/advanced';   // Durability, hooks, guardrails, reflection, observability, streaming
```

---

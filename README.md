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

## Core: `@agntk/core`

### Creating an Agent

```typescript
import { createAgent } from '@agntk/core';

const agent = createAgent({
  role: 'coder',
  toolPreset: 'standard',
  workspaceRoot: process.cwd(),
  maxSteps: 10,
});

// Synchronous generation
const result = await agent.generate({ prompt: 'Read package.json and list the dependencies' });
console.log(result.text);
console.log(result.steps);

// Streaming generation
const stream = await agent.stream({ prompt: 'Explain this codebase' });

for await (const chunk of stream.fullStream) {
  if (chunk.type === 'text-delta') process.stdout.write(chunk.textDelta);
}

const text = await stream.text;
```

### Agent Interface

```typescript
interface Agent {
  agentId: string;
  role: AgentRole;
  init(): Promise<void>;              // Loads memory context, initializes telemetry
  generate(input: { prompt: string }): Promise<GenerateResult>;
  stream(input: { prompt: string }): Promise<StreamResult>;
  getToolLoopAgent(): ToolLoopAgent;   // Access underlying AI SDK instance
  getSystemPrompt(): string;
}
```

`init()` is called automatically by `generate()` and `stream()` on first use.

### `AgentOptions` Reference

```typescript
const agent = createAgent({
  // ── Identity ──────────────────────────────────────────────
  role: 'coder',                // 'generic' | 'coder' | 'researcher' | 'analyst'
  systemPrompt: 'You are...',   // Override role-based system prompt
  systemPromptPrefix: '...',    // Prepend context without replacing role prompt
  agentId: 'my-agent-1',       // Custom identifier

  // ── Model ─────────────────────────────────────────────────
  model: myModelInstance,       // AI SDK LanguageModel (highest priority)
  modelProvider: 'openrouter',  // 'openrouter' | 'ollama' | 'openai'
  modelName: 'google/gemini-3-flash-preview',

  // ── Tools ─────────────────────────────────────────────────
  toolPreset: 'standard',      // 'none' | 'minimal' | 'standard' | 'full'
  tools: { myTool: ... },      // Custom tools (merged with preset)
  enableTools: ['shell'],       // Whitelist — only these tools active
  disableTools: ['browser'],    // Blacklist — remove from preset
  maxToolRetries: 3,            // Retries per tool on ModelRetry errors

  // ── Execution ─────────────────────────────────────────────
  maxSteps: 10,                 // Max tool-loop iterations (default: 10)
  usageLimits: {                // Token and request caps
    maxRequests: 20,
    maxTotalTokens: 100_000,
  },
  reflection: {                 // Reflection between tool steps
    strategy: 'reflact',        // 'reflact' | 'periodic' | 'none'
  },

  // ── Approval & Guardrails ─────────────────────────────────
  approval: true,               // Require human approval for dangerous tools
  guardrails: {                 // Input/output validation (generate only)
    output: [contentFilter()],
    onBlock: 'retry',
  },

  // ── Sub-Agents ────────────────────────────────────────────
  enableSubAgents: true,        // Adds spawn_agent tool (default: false)
  maxSpawnDepth: 2,             // Prevent infinite recursion (default: 2)

  // ── Durability ────────────────────────────────────────────
  durable: true,                // Wrap tools with workflow step directives
  workflowOptions: {
    defaultRetryCount: 3,
    defaultTimeout: '5m',
  },

  // ── Memory ────────────────────────────────────────────────
  enableMemory: true,           // Markdown-based persistent memory
  memoryOptions: {
    projectDir: './.agntk',
    globalDir: '~/.agntk',
  },

  // ── Skills ────────────────────────────────────────────────
  skills: {
    directories: ['.agents/skills'],  // Discovers SKILL.md files
  },

  // ── Environment ───────────────────────────────────────────
  workspaceRoot: process.cwd(), // Root for file operations

  // ── Telemetry ─────────────────────────────────────────────
  telemetry: {                  // Langfuse integration (optional peer deps)
    provider: { provider: 'langfuse' },
    functionId: 'my-agent',
  },
});
```

### Tool Presets

| Preset | Tools |
|--------|-------|
| `none` | No tools |
| `minimal` | `glob` |
| `standard` | `glob`, `grep`, `file_read`, `file_write`, `file_edit`, `file_create`, `search_skills`, `shell`, `background`, `plan`, `deep_reasoning` |
| `full` | All standard tools + `ast_grep_search`, `ast_grep_replace`, `progress_read`, `progress_update`, `browser` |

Custom tools are always merged with the preset:

```typescript
const agent = createAgent({
  toolPreset: 'standard',
  tools: { myCustomTool },
  disableTools: ['shell'],
});
```

### Roles

Each role provides a tuned system prompt and recommended model tier:

| Role | Model Tier | Description |
|------|-----------|-------------|
| `generic` | standard | General-purpose assistant |
| `coder` | powerful | Software engineering — reads/writes code, runs shell commands |
| `researcher` | standard | Information gathering and analysis |
| `analyst` | standard | Data analysis and reporting |

Custom roles can be registered programmatically via `registerRole()` or defined in a config file.

### Streaming

```typescript
const stream = await agent.stream({ prompt: 'Build a REST API' });

for await (const chunk of stream.fullStream) {
  switch (chunk.type) {
    case 'text-delta':    console.log(chunk.textDelta); break;
    case 'tool-call':     console.log('Calling:', chunk.toolName); break;
    case 'tool-result':   console.log('Result:', chunk.result); break;
    case 'step-finish':   console.log('Step done'); break;
    case 'finish':        console.log('Complete'); break;
  }
}

const text = await stream.text;
```

### Configuration

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
  "roles": {
    "debugger": {
      "systemPrompt": "You are a debugging specialist.",
      "recommendedModel": "reasoning",
      "defaultTools": ["shell", "grep", "glob"]
    }
  },
  "tools": {
    "shell": { "timeout": 30000 },
    "glob": { "maxFiles": 100 }
  },
  "maxSteps": 10
}
```

```typescript
import { loadConfig, configure, resolveModel } from '@agntk/core';

const config = loadConfig('./agent-sdk.config.json');

configure({ models: { defaultProvider: 'openrouter' } });

const model = resolveModel({ tier: 'powerful' });
const fastModel = resolveModel({ tier: 'fast', provider: 'openrouter' });
```

### Providers

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

### Model Tiers

| Tier | Purpose | OpenRouter Default |
|------|---------|-------------------|
| `fast` | Quick responses, low cost | `x-ai/grok-4.1-fast` |
| `standard` | Balanced quality/cost | `google/gemini-3-flash-preview` |
| `reasoning` | Complex logic, planning | `deepseek/deepseek-r1` |
| `powerful` | Best quality, highest cost | `z-ai/glm-4.7` |

Override per-tier via environment variables: `AGENT_SDK_MODEL_FAST`, `AGENT_SDK_MODEL_STANDARD`, `AGENT_SDK_MODEL_REASONING`, `AGENT_SDK_MODEL_POWERFUL`.

### Approval

Require human approval before executing dangerous tools (`shell`, `browser`, `file_write`, `file_edit`, `file_create`):

```typescript
const agent = createAgent({
  approval: true,  // Enable for default dangerous tools
});

// Fine-grained control:
const agent = createAgent({
  approval: {
    enabled: true,
    tools: ['shell'],
    timeout: 30000,
  },
});
```

### Guardrails

Input/output validation with built-in guardrails:

```typescript
import { contentFilter, topicFilter, lengthLimit } from '@agntk/core/advanced';

const agent = createAgent({
  guardrails: {
    input: [topicFilter(['harmful-topic'])],
    output: [contentFilter({ redact: true }), lengthLimit({ maxChars: 5000 })],
    onBlock: 'retry',   // 'throw' | 'retry' | 'filter'
    maxRetries: 3,
  },
});
```

Built-in guardrails: `contentFilter` (PII detection/redaction), `topicFilter` (keyword/regex blocklist), `lengthLimit` (character/word limits), `custom` (arbitrary check function).

### Reflection

Inject goal-state reflection between tool steps:

```typescript
const agent = createAgent({
  reflection: { strategy: 'reflact' },      // After every step
  // or
  reflection: { strategy: 'periodic', frequency: 3 },  // Every 3 steps
});
```

### Memory

Markdown-file-based persistent memory using `.agntk/` (project-local) and `~/.agntk/` (global):

```typescript
const agent = createAgent({ enableMemory: true });
// Adds tools: remember, recall, update_context, forget
// Auto-loads memory context into system prompt on first generate/stream
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

### Skills

Auto-discover `SKILL.md` files and inject into the agent's system prompt:

```typescript
const agent = createAgent({
  skills: { directories: ['.agents/skills'] },
});
```

Default discovery directories: `.claude/skills`, `.cursor/skills`, `.agents/skills`, `skills`

Skills support YAML frontmatter with `name`, `description`, `tags`, `when_to_use`, `requires-binaries`, `requires-env`, and more. Eligibility filtering checks that required binaries and env vars are present.

### Durable Agents

Wrap tools with Workflow DevKit step directives for crash recovery:

```typescript
const agent = createAgent({
  durable: true,
  workflowOptions: {
    defaultRetryCount: 3,
    defaultTimeout: '5m',
  },
});
```

Requires the `workflow` package (optional peer dependency). Without it, durable wrapping is inert.

### Workflow Hooks

Human-in-the-loop approval with typed hooks:

```typescript
import { defineHook, getHookRegistry } from '@agntk/core/workflow';

const approvalHook = defineHook<{ amount: number }, boolean>({
  name: 'purchase-approval',
  description: 'Approve large purchases',
  timeout: '30m',
  defaultValue: false,
});

const approved = await approvalHook.wait({ amount: 5000 });
```

### Workflow Builders

```typescript
import { createPipeline, createParallel, createTeam } from '@agntk/core/workflow';

// Sequential agent chain
const pipeline = createPipeline([researchAgent, writerAgent, editorAgent]);

// Parallel execution with synthesis
const parallel = createParallel([agent1, agent2], synthesizeFn);

// Multi-agent team with coordinator
const team = createTeam({ coordinator, members: [coder, tester] });
```

### Scheduled Workflows

```typescript
import { createScheduledWorkflow, parseDuration, formatDuration } from '@agntk/core/workflow';

const schedule = createScheduledWorkflow({
  name: 'daily-check',
  interval: '1h',
  task: async (iteration) => `Check #${iteration} passed`,
  onTick: (result, i) => console.log(result),
  maxIterations: 24,
});

await schedule.start();

parseDuration('2h');      // 7200000 (ms)
formatDuration(7200000);  // "2h"
```

### Sub-Path Exports

Advanced features are available via sub-path imports:

```typescript
import { ... } from '@agntk/core';           // Core essentials
import { ... } from '@agntk/core/workflow';   // Durability, hooks, teams, pipelines, scheduling
import { ... } from '@agntk/core/tools';      // Tool factories
import { ... } from '@agntk/core/evals';      // Eval suite and assertions
import { ... } from '@agntk/core/advanced';   // Guardrails, reflection, observability, streaming
```

---

## CLI: `@agntk/cli`

```bash
# One-shot prompt
agntk "organize this folder by date"

# Interactive REPL
agntk -i --memory

# With specific role and model
agntk --role coder --model google/gemini-3-flash-preview "fix the failing tests"

# Pipe input
cat error.log | agntk "explain these errors"

# Dry run (preview actions)
agntk --dry-run "delete old logs"
```

| Flag | Short | Description |
|------|-------|-------------|
| `--interactive` | `-i` | Interactive REPL mode |
| `--role` | `-r` | Agent role (`generic`, `coder`, `researcher`, `analyst`) |
| `--model` | `-m` | Model to use (e.g. `google/gemini-3-flash-preview`) |
| `--memory` | | Enable persistent memory |
| `--tools` | | Tool preset (`minimal`, `standard`, `full`) |
| `--workspace` | | Workspace root (default: cwd) |
| `--max-steps` | | Maximum agent steps |
| `--dry-run` | | Preview actions without executing |
| `--verbose` | | Show detailed logging |
| `--config` | | Config file path |
| `--init` | | Initialize `.agntk/` directory with templates |
| `--version` | `-v` | Show version |
| `--help` | `-h` | Show help |

---

## Server: `@agntk/server`

Hono-based HTTP server with REST, SSE streaming, and WebSocket endpoints.

```typescript
import { createAgentServer } from '@agntk/server';
import { createAgent } from '@agntk/core';

const agent = createAgent({ role: 'coder', toolPreset: 'standard' });
const server = createAgentServer({ agent, port: 3000 });
server.start();
```

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/status` | Agent info (role, tools, model) |
| `GET` | `/queue` | Concurrency queue stats |
| `GET` | `/config` | Read config file |
| `PUT` | `/config` | Update config file |
| `GET` | `/logs` | SSE stream of log entries |
| `POST` | `/generate` | Synchronous generation |
| `POST` | `/stream` | SSE streaming generation |
| `POST` | `/chat` | SSE streaming via `agent.stream()` |
| `GET` | `/hooks` | List workflow hooks (filterable by status) |
| `GET` | `/hooks/:id` | Get specific hook details |
| `POST` | `/hooks/:id/resume` | Resume a suspended hook |
| `POST` | `/hooks/:id/reject` | Reject a suspended hook |
| `WS` | `/ws/browser-stream` | Real-time browser viewport streaming |

**Middleware**: CORS, body size limits (1MB), rate limiting (100 req/min on generation endpoints), optional API key auth, optional concurrency queue.

---

## Client: `@agntk/client`

Client library for connecting to an Agent SDK server.

```typescript
import { AgentHttpClient } from '@agntk/client';

const client = new AgentHttpClient('http://localhost:3000');

// Synchronous generate
const result = await client.generate({
  messages: [{ role: 'user', content: 'Hello!' }],
});

// Streaming generate (SSE)
for await (const event of client.generateStream({
  messages: [{ role: 'user', content: 'Tell me a story' }],
})) {
  if (event.type === 'text-delta') {
    process.stdout.write(event.textDelta);
  }
}
```

**Available clients**: `AgentClient` (combined HTTP + WebSocket), `AgentHttpClient` (HTTP only), `ChatClient` (SSE with callbacks), `AgentWebSocketClient` (WebSocket with auto-reconnect), `BrowserStreamClient` (browser viewport streaming).

---

## Logger: `@agntk/logger`

Zero-dependency structured logging with namespace filtering.

```typescript
import { createLogger } from '@agntk/logger';

const log = createLogger('@myapp:feature');
log.info('Request processed', { userId: '123', durationMs: 45 });
log.warn('Rate limit approaching');
log.error('Failed to connect', { error: err.message });
```

Namespace filtering via `DEBUG` env var (e.g. `DEBUG=@agntk/core:*`). Transports: console, file, SSE. Formatters: pretty, JSON, SSE.

---

## Project Structure

```
agent-sdk/
├── packages/
│   ├── sdk/           # @agntk/core — Core agent factory
│   ├── cli/           # @agntk/cli — CLI agent
│   ├── agntk/         # agntk — npx wrapper
│   ├── sdk-server/    # @agntk/server — HTTP server
│   ├── sdk-client/    # @agntk/client — Client library
│   └── logger/        # @agntk/logger — Structured logging
├── apps/
│   └── docs/          # Documentation site (Starlight)
└── tests/
    └── integration/   # Integration tests
```

## Requirements

- Node.js >= 20
- pnpm >= 9
- Workflow DevKit (optional, for durable workflows)
- Langfuse + @vercel/otel (optional, for observability)

## License

MIT

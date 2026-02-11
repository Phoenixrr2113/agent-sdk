# Agent SDK

A modular AI agent framework built on [Vercel AI SDK](https://ai-sdk.dev). Zero-config agents with real tools, durable workflows, knowledge graphs, and HTTP interfaces.

## Packages

| Package | Description |
|---------|-------------|
| `@agntk/core` | Core agent factory — tools, roles, config, streaming, durability, hooks, scheduling |
| `@agntk/server` | Hono HTTP server — REST + SSE + WebSocket endpoints |
| `@agntk/client` | Client library — HTTP, SSE streams, WebSocket, session management |
| `@agntk/logger` | Structured logging — namespace filtering, file/SSE transports, formatters |
| `@agntk/brain` | Knowledge graph — FalkorDB, code parsing, NLP entity extraction |

## Quick Start

```bash
pnpm install
pnpm build
pnpm test

# Run integration tests (exercises all packages with real LLM calls)
pnpm --filter demo integration
```

---

## Core: `@agntk/core`

### Creating an Agent

```typescript
import { createAgent } from '@agntk/core';

const agent = createAgent({
  role: 'coder',                // 'generic' | 'coder' | 'researcher' | 'analyst'
  toolPreset: 'standard',       // 'none' | 'minimal' | 'standard' | 'full'
  workspaceRoot: process.cwd(),
  maxSteps: 10,                 // Default: 10
});

// Synchronous generation (waits for full response)
const result = await agent.generate({ prompt: 'Read package.json and list the dependencies' });
console.log(result.text);
console.log(result.steps);      // Array of tool calls and results

// Streaming generation
const stream = await agent.stream({ prompt: 'Explain this codebase' });

for await (const chunk of stream.fullStream) {
  if (chunk.type === 'text-delta') process.stdout.write(chunk.textDelta);
}

// Or get the final text after consuming the stream:
const text = await stream.text;
```

### `AgentOptions` Reference

```typescript
const agent = createAgent({
  // ── Identity ──────────────────────────────────────────────
  role: 'coder',                // Predefined role (sets system prompt + model tier)
  systemPrompt: 'You are...',   // Override role-based system prompt
  agentId: 'my-agent-1',       // Custom identifier

  // ── Model ─────────────────────────────────────────────────
  model: myModelInstance,       // AI SDK LanguageModel (highest priority)
  modelProvider: 'openrouter',  // 'openrouter' | 'ollama' | 'openai' | 'anthropic' | 'google'
  modelName: 'gpt-4o',         // Specific model within provider

  // ── Tools ─────────────────────────────────────────────────
  toolPreset: 'standard',      // Preset tool collection (see table below)
  tools: { myTool: ... },      // Custom tools (merged with preset)
  enableTools: ['shell'],       // Whitelist — only these tools active
  disableTools: ['browser'],    // Blacklist — remove from preset

  // ── Execution ─────────────────────────────────────────────
  maxSteps: 10,                 // Max tool-loop iterations (default: 10)
  stopWhen: (ctx) => false,     // Custom stop condition

  // ── Sub-Agents ────────────────────────────────────────────
  enableSubAgents: true,        // Adds spawn_agent tool (default: false)
  maxSpawnDepth: 2,             // Prevent infinite recursion (default: 2)

  // ── Durability ────────────────────────────────────────────
  durable: true,                // Wrap as DurableAgent with crash recovery
  workflowOptions: {
    defaultRetryCount: 3,
    defaultTimeout: '5m',
  },

  // ── Memory ────────────────────────────────────────────────
  enableMemory: true,           // Vectra-based vector memory
  memoryOptions: {
    path: './memory-index',
    topK: 5,
    similarityThreshold: 0.7,
  },

  // ── Brain (Knowledge Graph) ───────────────────────────────
  brain: brainInstance,          // Injects queryKnowledge, remember, recall, extractEntities tools

  // ── Skills ────────────────────────────────────────────────
  skills: {
    directories: ['.agents/skills'],  // Discovers SKILL.md files
  },

  // ── Streaming ─────────────────────────────────────────────
  enableTransientStreaming: true, // Stream tool data without adding to context (default: true)

  // ── Environment ───────────────────────────────────────────
  workspaceRoot: process.cwd(), // Root for file operations

  // ── Callbacks ─────────────────────────────────────────────
  onStepFinish: (step, i) => {},  // After each tool execution
  onEvent: (event) => {},         // Streaming events
  askUserHandler: async (q) => prompt(q), // Human-in-the-loop
});
```

### Tool Presets

| Preset | Tools |
|--------|-------|
| `none` | No tools |
| `minimal` | `glob` |
| `standard` | `glob`, `grep`, `shell`, `plan`, `deep_reasoning` |
| `full` | `glob`, `grep`, `shell`, `plan`, `deep_reasoning`, `ast_grep_search`, `ast_grep_replace`, `browser` |

Custom tools are always merged with the preset:

```typescript
const agent = createAgent({
  toolPreset: 'standard',
  tools: { myCustomTool },     // Added alongside preset tools
  disableTools: ['shell'],     // Remove shell from standard preset
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

Roles are extensible via config YAML (see [Configuration](#configuration)).

### Streaming

```typescript
// Stream returns a promise that resolves to a stream result
const stream = await agent.stream({ prompt: 'Build a REST API' });

// Option 1: Consume the full stream (gives you all event types)
for await (const chunk of stream.fullStream) {
  switch (chunk.type) {
    case 'text-delta':    console.log(chunk.textDelta); break;
    case 'tool-call':     console.log('Calling:', chunk.toolName); break;
    case 'tool-result':   console.log('Result:', chunk.result); break;
    case 'step-finish':   console.log('Step done'); break;
    case 'finish':        console.log('Complete'); break;
  }
}

// Option 2: Just get the final text (waits for stream to complete)
const text = await stream.text;
```

### Configuration

The SDK uses a cascading config system:

1. **YAML file** — `agent-sdk.config.yaml` in your project root
2. **Programmatic** — `configure()` at runtime
3. **Defaults** — built-in fallbacks

```yaml
# agent-sdk.config.yaml
models:
  defaultProvider: openrouter
  tiers:
    fast: google/gemini-2.0-flash-001
    standard: google/gemini-2.0-flash-001
    reasoning: anthropic/claude-sonnet-4
    powerful: anthropic/claude-opus-4

roles:
  debugger:
    systemPrompt: |
      You are a debugging specialist for {{projectName}}.
    recommendedModel: reasoning
    defaultTools: [shell, grep, glob]

templates:
  variables:
    projectName: my-project

tools:
  shell:
    timeout: 30000
  glob:
    maxFiles: 100

maxSteps: 10
```

```typescript
import { loadConfig, configure, getConfig, resolveModel } from '@agntk/core';

// Load from YAML
const config = loadConfig('./agent-sdk.config.yaml');

// Override programmatically
configure({ models: { defaultProvider: 'anthropic' } });

// Resolve models by tier
const model = resolveModel({ tier: 'powerful' });
const fastModel = resolveModel({ tier: 'fast', provider: 'openrouter' });
```

### Model Tiers

| Tier | Purpose | Example |
|------|---------|---------|
| `fast` | Quick responses, low cost | Gemini Flash, GPT-4o-mini |
| `standard` | Balanced quality/cost | Gemini Flash, Claude Haiku |
| `reasoning` | Complex logic, planning | Claude Sonnet, o1-mini |
| `powerful` | Best quality, highest cost | Claude Opus, GPT-4o |

### Durable Agents

Wrap agents in Temporal-style workflows for crash recovery and auto-retry:

```typescript
const agent = createAgent({
  role: 'coder',
  durable: true,
  toolPreset: 'standard',
});

// Standard methods still work (passthrough)
const result = await agent.generate({ prompt: 'Refactor utils.ts' });

// Durable-specific methods
const durableResult = await agent.durableGenerate('Complex multi-step task');

// Human-in-the-loop approval
const approved = await agent.withApproval('Deploy to production?');

// Scheduled execution
agent.scheduled('1h', async () => { /* health check */ });
```

### Workflow Hooks

Human-in-the-loop approval with typed hooks:

```typescript
import { defineHook, getHookRegistry } from '@agntk/core';

const approvalHook = defineHook<{ amount: number }, boolean>({
  name: 'purchase-approval',
  description: 'Approve large purchases',
  timeout: '30m',
  defaultValue: false,  // Auto-reject if timeout expires
});

// In your agent workflow:
const approved = await approvalHook.wait({ amount: 5000 });

// From your API/UI:
const registry = getHookRegistry();
// Resume via POST /hooks/:id/resume endpoint
```

### Scheduled Workflows

Recurring tasks with zero-compute sleep:

```typescript
import { createScheduledWorkflow, parseDuration, formatDuration } from '@agntk/core';

const schedule = createScheduledWorkflow({
  name: 'daily-check',
  interval: '1h',
  task: async (iteration) => {
    return `Check #${iteration} passed`;
  },
  onTick: (result, i) => console.log(result),
  maxIterations: 24,
});

await schedule.start();

// Duration utilities
parseDuration('2h');      // 7200000 (ms)
formatDuration(7200000);  // "2h"
```

### Skills

Auto-discover and inject `SKILL.md` files into the agent's system prompt:

```typescript
import { createAgent, discoverSkills, buildSkillsSystemPrompt } from '@agntk/core';

// Automatic via createAgent:
const agent = createAgent({
  skills: { directories: ['.agents/skills'] },
});

// Manual:
const skills = await discoverSkills('./.agents/skills');
const skillPrompt = buildSkillsSystemPrompt(skills);
```

### System Prompts

```typescript
import { systemPrompt, rolePrompts, buildSystemContext } from '@agntk/core';

// Default system prompt
console.log(systemPrompt);

// Per-role prompts
console.log(rolePrompts.coder);

// Build context string
const context = buildSystemContext({
  workspaceRoot: '/my/project',
  role: 'coder',
});
```

### Observability

Optional Langfuse integration for tracing:

```typescript
import { initObservability, isObservabilityEnabled, createTelemetrySettings } from '@agntk/core';

if (isObservabilityEnabled()) {
  initObservability({
    langfuse: { publicKey: '...', secretKey: '...' },
  });
}

const settings = createTelemetrySettings({ agentId: 'my-agent', role: 'coder' });
```

---

## Brain: `@agntk/brain`

Knowledge graph backed by FalkorDB with code parsing and NLP entity extraction.

```typescript
import { createBrain } from '@agntk/brain';

// Connect to FalkorDB
const brain = await createBrain({
  graph: { host: 'localhost', port: 6379, graphName: 'my_graph' },
  extraction: { enabled: false },
});

// Use with an agent (auto-injects tools):
const agent = createAgent({
  brain,
  toolPreset: 'none',  // Brain provides its own tools
});
// Agent now has: queryKnowledge, remember, recall, extractEntities

// Direct usage:
await brain.remember('TypeScript uses structural typing');
const results = await brain.recall('typing system');
await brain.close();
```

Requires FalkorDB running locally:

```bash
docker run -p 6379:6379 falkordb/falkordb
```

---

## Server: `@agntk/server`

Hono-based HTTP server with REST, SSE streaming, and WebSocket endpoints.

```typescript
import { createAgentServer } from '@agntk/server';
import { createAgent } from '@agntk/core';

const agent = createAgent({ role: 'coder', toolPreset: 'standard' });
const server = createAgentServer({ agent, port: 3001 });
server.start();
// Server running at http://localhost:3001
```

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check — returns `{ status: 'ok' }` |
| `GET` | `/status` | Server status with version info |
| `POST` | `/generate` | Synchronous generation |
| `POST` | `/stream` | SSE streaming generation |
| `POST` | `/hooks/:id/resume` | Resume a suspended workflow hook |
| `WS` | `/ws/browser-stream` | Real-time browser viewport streaming |

### Request Format

```typescript
// POST /generate or /stream
{
  "prompt": "What is 2+2?",
  // OR use messages array:
  "messages": [
    { "role": "user", "content": "What is 2+2?" }
  ],
  "sessionId": "optional-session-id"
}
```

### Server Options

```typescript
import { createAgentServer, createRateLimitMiddleware, createAuthMiddleware } from '@agntk/server';

const server = createAgentServer({
  agent,
  port: 3001,
  // Middleware is available but optional
});
```

---

## Client: `@agntk/client`

Client library for connecting to an Agent SDK server.

```typescript
import { AgentHttpClient } from '@agntk/client';

const client = new AgentHttpClient('http://localhost:3001');

// Synchronous generate
const result = await client.generate({
  messages: [{ role: 'user', content: 'Hello!' }],
});
console.log(result);

// Streaming generate (SSE)
for await (const event of client.generateStream({
  messages: [{ role: 'user', content: 'Tell me a story' }],
})) {
  if (event.type === 'text-delta') {
    process.stdout.write(event.textDelta);
  }
  if (event.type === 'finish') {
    console.log('\nDone:', event.text);
  }
}
```

### Stream Event Types

```typescript
type StreamEvent =
  | { type: 'text-delta'; textDelta: string }
  | { type: 'tool-call'; toolCallId: string; toolName: string; args: unknown }
  | { type: 'tool-result'; toolCallId: string; toolName: string; result: unknown }
  | { type: 'step-start'; stepIndex: number }
  | { type: 'step-finish'; stepIndex: number; finishReason: string }
  | { type: 'finish'; text: string; usage?: TokenUsage }
  | { type: 'error'; error: string };
```

### Resumable Streams

Streams support reconnection for durable agents:

```typescript
const gen = client.generateStream(request);

for await (const event of gen) {
  // Process events...
}

// After disconnect, get metadata for reconnection:
const metadata = client.lastStreamMetadata;

// Reconnect from where you left off:
const resumed = client.generateStream(request, {
  workflowRunId: metadata?.workflowRunId,
  lastEventId: metadata?.lastEventId,
});
```

### Other Clients

```typescript
import { AgentClient, ChatClient, AgentWebSocketClient, BrowserStreamClient } from '@agntk/client';

// High-level chat client with session management
const chat = new ChatClient(httpClient, { sessionId: 'abc' });
await chat.stream(request, {
  onTextDelta: (text) => console.log(text),
});

// WebSocket client for real-time communication
const ws = new AgentWebSocketClient({ url: 'ws://localhost:3001/ws' });

// Browser viewport streaming
const browser = new BrowserStreamClient({ url: 'ws://localhost:3001/ws/browser-stream' });
```

---

## Logger: `@agntk/logger`

Zero-dependency structured logging with namespace filtering.

```typescript
import { createLogger } from '@agntk/logger';

const log = createLogger('@myapp:feature');
log.info('Request processed', { userId: '123', durationMs: 45 });
log.warn('Rate limit approaching');
log.error('Failed to connect', { error: err.message });
log.debug('Cache hit', { key: 'user:123' });

// Timing helper
const done = log.time('db-query');
await queryDatabase();
done(); // Logs with duration
```

### Namespace Filtering

```bash
# Enable via environment variable
DEBUG=@agntk/core:* node app.js
DEBUG=@agntk/*,-@agntk/core:verbose node app.js
```

```typescript
import { enable, disable, resetConfig } from '@agntk/logger';

enable('@myapp:*');
disable('@myapp:verbose');
resetConfig();  // Clear all patterns
```

### Transports

```typescript
import { createConsoleTransport, createFileTransport, createSSETransport, addTransport } from '@agntk/logger';

// Console (default)
addTransport(createConsoleTransport({ colorize: true }));

// File output
addTransport(createFileTransport({ path: './logs/agent.log' }));

// SSE for real-time UI
const sse = createSSETransport();
```

### Formatters

```typescript
import { formatPretty, formatJSON, formatSSE } from '@agntk/logger';

const entry = { level: 'info', namespace: '@app', message: 'hello', timestamp: Date.now(), data: {} };

formatPretty(entry); // "INF [@app] hello"
formatJSON(entry);   // {"level":"info","namespace":"@app",...}
formatSSE(entry);    // "data: {...}\n\n"
```

---

## Workflow Observability

Durable agents record steps visible in the workflow inspector:

```bash
# Launch the workflow inspector UI
pnpm inspect

# Or directly:
npx workflow inspect runs --web
```

| Step Name | Description |
|-----------|-------------|
| `llmGenerate` | Standard LLM generation call |
| `llmDraft` | Draft generation (approval workflow) |
| `webhookApproval` | Webhook suspension point (zero compute) |
| `llmFinalize` | Final generation after approval |
| `durableSleep` | Durable delay (zero compute) |
| `tool-exec-{name}` | Individual tool executions |

---

## Project Structure

```
agent-sdk/
├── packages/
│   ├── sdk/           # @agntk/core — Core agent factory
│   ├── sdk-server/    # @agntk/server — HTTP server
│   ├── sdk-client/    # @agntk/client — Client library
│   ├── logger/        # @agntk/logger — Structured logging
│   └── brain/         # @agntk/brain — Knowledge graph
├── apps/
│   ├── demo/          # Integration tests and demos
│   └── web/           # Next.js dashboard
└── agent-sdk.config.yaml
```

## Requirements

- Node.js >= 20
- pnpm >= 9
- FalkorDB (optional, for `@agntk/brain`)
- Temporal (optional, for durable workflows)

## License

MIT

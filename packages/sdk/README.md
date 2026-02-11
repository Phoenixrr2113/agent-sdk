# @agntk/core

Core agent factory for the Agent SDK. Built on [Vercel AI SDK](https://ai-sdk.dev).

## Installation

```bash
pnpm add @agntk/core
```

## Quick Start

```typescript
import { createAgent } from '@agntk/core';

const agent = createAgent({
  role: 'coder',
  toolPreset: 'standard',
  workspaceRoot: process.cwd(),
});

// Generate (waits for full response)
const result = await agent.generate({
  prompt: 'Read package.json and summarize the dependencies',
});
console.log(result.text);
console.log(result.steps);  // Array of tool calls and results

// Stream (real-time chunks)
const stream = await agent.stream({ prompt: 'Explain this codebase' });
for await (const chunk of stream.fullStream) {
  if (chunk.type === 'text-delta') process.stdout.write(chunk.textDelta);
}
// Or just get the text after the stream finishes:
const text = await stream.text;
```

## Agent Interface

```typescript
interface Agent {
  agentId: string;
  role: string;

  generate(input: { prompt: string }): Promise<GenerateResult>;
  stream(input: { prompt: string }): Promise<StreamResult>;

  getSystemPrompt(): string;
  getToolLoopAgent(): ToolLoopAgent;
}

interface GenerateResult {
  text: string;
  steps: StepResult[];  // Each step contains toolCalls and toolResults
}

interface StreamResult {
  fullStream: AsyncIterable<StreamChunk>;  // All event types
  text: Promise<string>;                   // Final accumulated text
}
```

## `createAgent(options)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `role` | `'generic' \| 'coder' \| 'researcher' \| 'analyst'` | `'generic'` | Predefined role with system prompt |
| `systemPrompt` | `string` | Role default | Override system prompt |
| `agentId` | `string` | Auto-generated | Unique identifier |
| `maxSteps` | `number` | `10` | Max tool-loop iterations |
| `model` | `LanguageModel` | Auto-resolved | AI SDK model instance |
| `modelProvider` | `string` | Config default | `'openrouter' \| 'openai' \| 'anthropic' \| 'google' \| 'ollama'` |
| `modelName` | `string` | Tier default | Specific model name |
| `toolPreset` | `string` | `'standard'` | `'none' \| 'minimal' \| 'standard' \| 'full'` |
| `tools` | `Record<string, Tool>` | `{}` | Custom tools (merged with preset) |
| `enableTools` | `string[]` | All | Whitelist — only these tools active |
| `disableTools` | `string[]` | None | Blacklist — remove from preset |
| `enableSubAgents` | `boolean` | `false` | Adds `spawn_agent` tool |
| `maxSpawnDepth` | `number` | `2` | Max sub-agent nesting |
| `durable` | `boolean` | `false` | Wrap as DurableAgent |
| `enableMemory` | `boolean` | `false` | Vectra vector memory |
| `brain` | `BrainInstance` | None | Knowledge graph (auto-injects tools) |
| `skills` | `SkillsConfig` | None | Auto-discover SKILL.md files |
| `workspaceRoot` | `string` | `process.cwd()` | Root for file operations |
| `enableTransientStreaming` | `boolean` | `true` | Stream tool data without context |
| `onStepFinish` | `(step, index) => void` | None | After each step |
| `askUserHandler` | `(question) => Promise<string>` | None | Human-in-the-loop input |

## Tool Presets

| Preset | Tools |
|--------|-------|
| `none` | No tools |
| `minimal` | `glob` |
| `standard` | `glob`, `grep`, `shell`, `plan`, `deep_reasoning` |
| `full` | `glob`, `grep`, `shell`, `plan`, `deep_reasoning`, `ast_grep_search`, `ast_grep_replace`, `browser` |

```typescript
import { createToolPreset } from '@agntk/core';

// Get tools without creating an agent
const tools = createToolPreset('standard', { workspaceRoot: '/my/project' });
```

## Configuration

### YAML Config File

Place `agent-sdk.config.yaml` in your project root:

```yaml
models:
  defaultProvider: openrouter
  tiers:
    fast: google/gemini-2.0-flash-001
    standard: google/gemini-2.0-flash-001
    reasoning: anthropic/claude-sonnet-4
    powerful: anthropic/claude-opus-4

roles:
  debugger:
    systemPrompt: You are a debugging specialist.
    recommendedModel: reasoning
    defaultTools: [shell, grep, glob]

tools:
  shell:
    timeout: 30000
  glob:
    maxFiles: 100
```

### Programmatic

```typescript
import { loadConfig, configure, getConfig, defineConfig, resolveModel } from '@agntk/core';

loadConfig('./agent-sdk.config.yaml');
configure({ models: { defaultProvider: 'anthropic' } });

const model = resolveModel({ tier: 'powerful' });
const config = getConfig();
```

## Model Tiers

| Tier | Purpose |
|------|---------|
| `fast` | Quick responses, low cost |
| `standard` | Balanced quality/cost |
| `reasoning` | Complex logic, chain-of-thought |
| `powerful` | Best quality, highest cost |

## Durable Agents

```typescript
const agent = createAgent({ durable: true, toolPreset: 'standard' });

// Standard methods still work
const result = await agent.generate({ prompt: 'Refactor utils.ts' });

// Durable methods (crash recovery, checkpointing)
const durableResult = await (agent as DurableAgent).durableGenerate('Complex task');
```

## Workflow Hooks

```typescript
import { defineHook, getHookRegistry } from '@agntk/core';

const hook = defineHook<{ amount: number }, boolean>({
  name: 'purchase-approval',
  timeout: '30m',
  defaultValue: false,
});

const approved = await hook.wait({ amount: 5000 });
```

## Scheduled Workflows

```typescript
import { createScheduledWorkflow, parseDuration, formatDuration } from '@agntk/core';

const schedule = createScheduledWorkflow({
  name: 'hourly-check',
  interval: '1h',
  task: async (i) => `Check #${i}`,
  maxIterations: 24,
});
await schedule.start();

parseDuration('2h');      // 7200000
formatDuration(7200000);  // "2h"
```

## Brain Integration

```typescript
import { createBrain } from '@agntk/brain';

const brain = await createBrain({
  graph: { host: 'localhost', port: 6379, graphName: 'my_graph' },
});

const agent = createAgent({ brain, toolPreset: 'none' });
// Agent now has: queryKnowledge, remember, recall, extractEntities

await brain.close();
```

## Skills

```typescript
import { createAgent, discoverSkills, buildSkillsSystemPrompt } from '@agntk/core';

// Auto-discover:
const agent = createAgent({ skills: { directories: ['.agents/skills'] } });

// Manual:
const skills = await discoverSkills('./.agents/skills');
const prompt = buildSkillsSystemPrompt(skills);
```

## System Prompts

```typescript
import { systemPrompt, rolePrompts, buildSystemContext } from '@agntk/core';

console.log(systemPrompt);        // Default system prompt
console.log(rolePrompts.coder);   // Coder-specific prompt

const ctx = buildSystemContext({ workspaceRoot: '/my/project', role: 'coder' });
```

## Exports

```typescript
// Core
export { createAgent } from '@agntk/core';

// Config
export { loadConfig, configure, getConfig, defineConfig, resolveModel } from '@agntk/core';

// Presets
export { createToolPreset, toolPresets, roleConfigs } from '@agntk/core';

// Prompts
export { systemPrompt, rolePrompts, buildSystemContext } from '@agntk/core';

// Skills
export { discoverSkills, buildSkillsSystemPrompt } from '@agntk/core';

// Workflow
export { createDurableAgent, defineHook, getHookRegistry, createScheduledWorkflow } from '@agntk/core';
export { parseDuration, formatDuration, wrapToolsAsDurable } from '@agntk/core';

// Memory
export { createMemoryStore, createMemoryTools } from '@agntk/core';

// Observability
export { initObservability, isObservabilityEnabled, createTelemetrySettings } from '@agntk/core';

// Streaming
export { streamTransient, withTransientStreaming } from '@agntk/core';
```

## License

MIT

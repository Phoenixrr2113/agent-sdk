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
| `systemPromptPrefix` | `string` | None | Prepend context without replacing role prompt |
| `agentId` | `string` | Auto-generated | Unique identifier |
| `maxSteps` | `number` | `10` | Max tool-loop iterations |
| `model` | `LanguageModel` | Auto-resolved | AI SDK model instance |
| `modelProvider` | `string` | Config default | `'openrouter' \| 'openai' \| 'ollama'` (extensible) |
| `modelName` | `string` | Tier default | Specific model name |
| `toolPreset` | `string` | `'standard'` | `'none' \| 'minimal' \| 'standard' \| 'full'` |
| `tools` | `Record<string, Tool>` | `{}` | Custom tools (merged with preset) |
| `enableTools` | `string[]` | All | Whitelist — only these tools active |
| `disableTools` | `string[]` | None | Blacklist — remove from preset |
| `enableSubAgents` | `boolean` | `false` | Adds `spawn_agent` tool |
| `maxSpawnDepth` | `number` | `2` | Max sub-agent nesting |
| `durable` | `boolean` | `false` | Wrap as DurableAgent |
| `enableMemory` | `boolean` | `false` | Markdown-based persistent memory |
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
| `standard` | `glob`, `grep`, `file_read`, `file_create`, `file_edit`, `shell`, `background`, `plan`, `deep_reasoning`, `search_skills` |
| `full` | All standard tools + `ast_grep_search`, `ast_grep_replace`, `progress`, `browser` |

```typescript
import { createToolPreset } from '@agntk/core';

// Get tools without creating an agent
const tools = createToolPreset('standard', { workspaceRoot: '/my/project' });
```

## Configuration

### Config File

Place `agntk.config.json` in your project root:

```json
{
  "models": {
    "defaultProvider": "openrouter",
    "tiers": {
      "fast": "x-ai/grok-4.1-fast",
      "standard": "google/gemini-3-flash-preview",
      "reasoning": "deepseek/deepseek-r1",
      "powerful": "anthropic/claude-sonnet-4"
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
  }
}
```

### Programmatic

```typescript
import { loadConfig, configure, getConfig, defineConfig, resolveModel } from '@agntk/core';

loadConfig('./agntk.config.json');
configure({ models: { defaultProvider: 'openrouter' } });

const model = resolveModel({ tier: 'powerful' });
const config = getConfig();
```

## Providers

All providers use `@ai-sdk/openai-compatible` for unified access:

| Provider | Default | Description |
|----------|---------|-------------|
| `openrouter` | ✅ | Routes to any model (Anthropic, Google, Meta, etc.) |
| `openai` | | Direct OpenAI API |
| `ollama` | | Local models via Ollama |
| Custom | | Any OpenAI-compatible API via `customProviders` config |

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

## Skills

```typescript
import { createAgent, discoverSkills, buildSkillsSystemPrompt } from '@agntk/core';

// Auto-discover:
const agent = createAgent({ skills: { directories: ['.agents/skills'] } });

// Manual:
const skills = await discoverSkills('./.agents/skills');
const prompt = buildSkillsSystemPrompt(skills);
```

## License

MIT

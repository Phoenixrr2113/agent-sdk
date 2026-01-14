# SDK Configuration Architecture

## Goal

Make **everything configurable** at runtime without code changes. Config sources cascade with precedence:
1. **Explicit options** (highest) – passed to `createAgent()`
2. **Config file** – `agent-sdk.config.json` or JS/TS config
3. **Environment variables** – for secrets and deployment overrides
4. **Built-in defaults** (lowest) – sensible fallbacks

---

## Current State vs Target

| Area | Current | Target |
|------|---------|--------|
| **Roles** | 4 hardcoded in `roles.ts` | Registry + custom roles |
| **Sub-agents** | 4 hardcoded in `sub-agent-configs.ts` | Registry + custom sub-agents |
| **Tool presets** | 4 hardcoded in `tools.ts` | Custom preset definitions |
| **Models** | 4 tiers × 4 providers hardcoded | Custom tier → model mapping |
| **System prompts** | Hardcoded per role | Template-based with variables |
| **Memory** | Vectra-only | Pluggable adapters |
| **Streaming** | Boolean toggle | Customizable data part handlers |

---

## Proposed Configuration Schema

```typescript
// agent-sdk.config.ts
import { defineConfig } from '@agent/sdk';

export default defineConfig({
  // ════════════════════════════════════════════════════════════════════════
  // ROLES
  // ════════════════════════════════════════════════════════════════════════
  roles: {
    // Override built-in role
    coder: {
      systemPrompt: 'You are a {{language}} expert for {{projectName}}...',
      recommendedModel: 'powerful',
      defaultTools: ['filesystem', 'shell', 'grep', 'glob'],
    },
    // Add custom role
    debugger: {
      systemPrompt: 'You specialize in debugging and root cause analysis...',
      recommendedModel: 'reasoning',
      defaultTools: ['filesystem', 'shell', 'reasoning'],
    },
  },

  // ════════════════════════════════════════════════════════════════════════
  // SUB-AGENTS
  // ════════════════════════════════════════════════════════════════════════
  subAgents: {
    securityReviewer: {
      instructions: 'You review code for security vulnerabilities...',
      tools: ['filesystem', 'grep'],
      model: 'anthropic/claude-sonnet-4',
      maxSteps: 10,
    },
  },

  // ════════════════════════════════════════════════════════════════════════
  // TOOL PRESETS
  // ════════════════════════════════════════════════════════════════════════
  toolPresets: {
    // Override built-in preset
    standard: {
      include: ['filesystem', 'shell', 'plan', 'reasoning', 'grep', 'glob'],
      exclude: [],
    },
    // Add custom preset
    readonly: {
      include: ['read_text_file', 'list_directory', 'get_file_info', 'grep'],
      exclude: ['write_file', 'shell'],
    },
  },

  // ════════════════════════════════════════════════════════════════════════
  // MODELS
  // ════════════════════════════════════════════════════════════════════════
  models: {
    defaultProvider: 'openrouter',
    tiers: {
      fast: 'deepseek/deepseek-chat-v3-0324:free',
      standard: 'google/gemini-2.0-flash-001',
      reasoning: 'deepseek/deepseek-r1:free',
      powerful: 'anthropic/claude-sonnet-4',
    },
    // Custom tiers
    ultrafast: 'groq/llama-3.3-70b-versatile',
  },

  // ════════════════════════════════════════════════════════════════════════
  // TEMPLATES
  // ════════════════════════════════════════════════════════════════════════
  templates: {
    variables: {
      projectName: 'MyProject',
      language: 'TypeScript',
      codeStyle: 'functional',
    },
  },

  // ════════════════════════════════════════════════════════════════════════
  // MEMORY
  // ════════════════════════════════════════════════════════════════════════
  memory: {
    adapter: 'vectra', // or 'sqlite', 'neo4j', 'custom'
    path: './.agent/memory',
    embedModel: 'text-embedding-3-small',
    topK: 10,
    similarityThreshold: 0.7,
  },

  // ════════════════════════════════════════════════════════════════════════
  // STREAMING
  // ════════════════════════════════════════════════════════════════════════
  streaming: {
    enabled: true,
    transientDataParts: ['file-content', 'shell-output', 'reasoning-step'],
    customHandlers: {
      'my-custom-part': (data) => console.log(data),
    },
  },
});
```

---

## Implementation Plan

### Phase 1: Config Loading Infrastructure

| File | Change |
|------|--------|
| `src/config/loader.ts` | **[NEW]** Load config from file, env, options |
| `src/config/schema.ts` | **[NEW]** Zod schema for config validation |
| `src/config/defaults.ts` | **[NEW]** Default values (extract from hardcoded) |
| `src/config/index.ts` | **[NEW]** Exports `defineConfig()`, `loadConfig()` |

### Phase 2: Registry Pattern

| File | Change |
|------|--------|
| `src/presets/role-registry.ts` | **[NEW]** `registerRole()`, `getRole()` |
| `src/presets/sub-agent-registry.ts` | **[NEW]** `registerSubAgent()`, `getSubAgent()` |
| `src/presets/tool-preset-registry.ts` | **[NEW]** `registerToolPreset()`, `getToolPreset()` |
| `src/presets/roles.ts` | **[MODIFY]** Use registry, move defaults to `defaults.ts` |
| `src/presets/sub-agent-configs.ts` | **[MODIFY]** Use registry |
| `src/presets/tools.ts` | **[MODIFY]** Use registry |

### Phase 3: Template Variables

| File | Change |
|------|--------|
| `src/prompts/template.ts` | **[NEW]** `applyTemplate(prompt, variables)` |
| `src/prompts/context.ts` | **[MODIFY]** Use template engine |
| `src/presets/roles.ts` | **[MODIFY]** Apply templates to system prompts |

### Phase 4: Agent Factory Updates

| File | Change |
|------|--------|
| `src/agent.ts` | **[MODIFY]** Load config at startup, merge with options |
| `src/types/agent.ts` | **[MODIFY]** Add config-related options |
| `src/index.ts` | **[MODIFY]** Export `defineConfig` |

---

## Config Resolution Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    createAgent(options)                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     loadConfig()                             │
│  1. Find config file (agent-sdk.config.{ts,js,json})        │
│  2. Validate with Zod schema                                │
│  3. Merge with defaults                                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   mergeOptions()                             │
│  Priority: options > configFile > envVars > defaults        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   resolveRole(role)                          │
│  1. Check role-registry                                     │
│  2. Get systemPrompt, apply templates                       │
│  3. Get defaultTools, recommendedModel                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      buildTools()                            │
│  1. Get preset from tool-preset-registry                    │
│  2. Apply enableTools/disableTools filters                  │
│  3. Merge custom tools                                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    resolveModel()                            │
│  1. Check explicit model option                             │
│  2. Check config tier mapping                               │
│  3. Fall back to defaults                                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  new ToolLoopAgent()                         │
└─────────────────────────────────────────────────────────────┘
```

---

## Environment Variable Support

| Variable | Purpose |
|----------|---------|
| `AGENT_SDK_CONFIG` | Path to config file |
| `AGENT_SDK_ROLE` | Default role |
| `AGENT_SDK_PROVIDER` | Default model provider |
| `AGENT_SDK_MODEL_FAST` | Override fast tier model |
| `AGENT_SDK_MODEL_STANDARD` | Override standard tier model |
| `AGENT_SDK_MODEL_REASONING` | Override reasoning tier model |
| `AGENT_SDK_MODEL_POWERFUL` | Override powerful tier model |
| `AGENT_SDK_WORKSPACE` | Default workspace root |
| `AGENT_SDK_MEMORY_PATH` | Memory storage path |

---

## Example Usage

### Minimal (defaults only)

```typescript
import { createAgent } from '@agent/sdk';

const agent = createAgent(); // Uses all defaults
```

### With inline options

```typescript
const agent = createAgent({
  role: 'debugger', // Custom role from config
  toolPreset: 'readonly', // Custom preset from config
  maxSteps: 20,
});
```

### With config file

```bash
# agent-sdk.config.json loaded automatically
npx my-agent-app
```

### Programmatic config override

```typescript
import { createAgent, loadConfig } from '@agent/sdk';

const config = await loadConfig('./my-custom-config.json');

const agent = createAgent({
  ...config.defaults,
  role: 'coder',
});
```

---

## Migration Path

1. **No breaking changes** – All current APIs continue to work
2. **Opt-in config** – Config file is optional
3. **Gradual adoption** – Can configure one area at a time
4. **Deprecation warnings** – For any future API changes

---

## Verification Plan

### Unit Tests
- [ ] `src/config/__tests__/loader.test.ts` - Config file loading
- [ ] `src/config/__tests__/schema.test.ts` - Schema validation
- [ ] `src/presets/__tests__/role-registry.test.ts` - Role registry
- [ ] `src/presets/__tests__/tool-preset-registry.test.ts` - Tool preset registry

### Integration Tests
- [ ] Custom role from config file works
- [ ] Custom tool preset from config works
- [ ] Template variables are substituted
- [ ] Options override config file

### Manual Tests
- [ ] Create `agent-sdk.config.json` and verify it's loaded
- [ ] Add custom role and use it in `createAgent()`

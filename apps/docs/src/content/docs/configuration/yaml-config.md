---
title: YAML Configuration
description: Configure Agent SDK with YAML files
---

# YAML Configuration System

The SDK uses a cascading config system:

1. **YAML file** — `agent-sdk.config.yaml` in your project root
2. **Programmatic** — `configure()` at runtime
3. **Defaults** — built-in fallbacks

## Configuration File

Create `agent-sdk.config.yaml` in your project root:

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

## Loading Configuration

```typescript
import { loadConfig, configure, getConfig, resolveModel } from '@agent/sdk';

// Load from YAML
const config = loadConfig('./agent-sdk.config.yaml');

// Override programmatically
configure({ models: { defaultProvider: 'anthropic' } });

// Get current config
const current = getConfig();

// Resolve models by tier
const model = resolveModel({ tier: 'powerful' });
const fastModel = resolveModel({
  tier: 'fast',
  provider: 'openrouter'
});
```

## Model Tiers

| Tier | Purpose | Example |
|------|---------|---------|
| `fast` | Quick responses, low cost | Gemini Flash, GPT-4o-mini |
| `standard` | Balanced quality/cost | Gemini Flash, Claude Haiku |
| `reasoning` | Complex logic, planning | Claude Sonnet, o1-mini |
| `powerful` | Best quality, highest cost | Claude Opus, GPT-4o |

## Custom Roles

Define custom roles in your YAML:

```yaml
roles:
  myCustomRole:
    systemPrompt: |
      You are a {{projectName}} specialist.
      Your job is to {{roleDescription}}.
    recommendedModel: powerful
    defaultTools: [shell, grep, glob, browser]
```

Then use it:

```typescript
const agent = createAgent({
  role: 'myCustomRole',
  toolPreset: 'standard',
});
```

## Tool Configuration

Configure tool behavior:

```yaml
tools:
  shell:
    timeout: 30000
    maxOutput: 10000
  glob:
    maxFiles: 100
  browser:
    headless: true
```

## Template Variables

Use template variables in your config:

```yaml
templates:
  variables:
    projectName: my-project
    roleDescription: analyze code quality
```

Then reference them in prompts:

```yaml
roles:
  analyzer:
    systemPrompt: |
      You are analyzing {{projectName}}.
      {{roleDescription}}
```

## Next Steps

- [SDK Core](/packages/sdk) — Learn about agent options
- [Quick Start](/getting-started/quick-start) — Build your first agent


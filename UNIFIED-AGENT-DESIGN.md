# Unified Agent Design — Single `createAgent()` Discussion

> Created: 2025-02-11
> Status: Discussion / Design exploration
> Context: Reviewing workflow directory revealed proliferation of agent factories

---

## The Problem

The SDK currently has multiple ways to create agents:

```typescript
createAgent()              // main factory
createDurableAgent()       // deprecated wrapper
createTeam()               // separate multi-agent factory
createPipeline()           // sequential workflow factory
createParallel()           // fan-out workflow factory
createScheduledWorkflow()  // recurring task factory
createDailyBriefing()      // preset factory
createWeeklyReport()       // preset factory
```

This doesn't scale. When we add image generation, video, audio, code sandbox — do we add `createImageAgent()`, `createSandboxedAgent()`? No.

### The Configuration Hell Risk

But collapsing everything into one factory risks the opposite problem:

```typescript
// This is NOT what we want either
createAgent({
  role: 'coder',
  model: 'claude-sonnet-4-20250514',
  maxSteps: 25,
  toolPreset: 'standard',
  workspaceRoot: '/path',
  enableMemory: true,
  memoryOptions: { projectDir: '...', globalDir: '...' },
  durable: { tools: true, retryCount: 3, timeout: '5m' },
  team: { enabled: true, maxMembers: 5, taskBoard: true },
  capabilities: ['images', 'video', 'audio', 'sandbox'],
  approval: { tools: ['shell', 'write_file'] },
  guardrails: { input: [...], output: [...] },
  scheduling: { interval: '1d', maxIterations: 30 },
  sandbox: { runtime: 'quickjs', timeout: '30s' },
  reflection: { enabled: true, interval: 5 },
  skills: ['./skills/deploy.md'],
  modelProvider: 'anthropic',
  modelName: 'claude-sonnet-4-20250514',
  systemPrompt: '...',
  // ... 30 more options
});
```

That's just moving complexity from multiple factories into one mega-config object.

---

## Design Principles

1. **One `createAgent()` — no exceptions.** Everything else is internal.
2. **Smart defaults over explicit config.** The agent should figure most things out.
3. **Progressive disclosure.** Simple use = simple config. Advanced use = more knobs.
4. **The agent decides, not the user.** Team coordination, tool selection, when to use memory — these are runtime decisions the agent makes, not config the user sets.
5. **Capabilities are discovered, not declared.** If image tools are available in the environment, the agent can use them. No flag needed.

---

## Current `createAgent()` Signature (What Users Actually Pass)

Today, the CLI path shows what a minimal invocation looks like:

```typescript
const agent = createAgent({
  role: 'coder',
});
// That's it. Everything else has defaults.
```

The `runner.ts` only passes: `role`, `maxSteps`, `toolPreset`, `workspaceRoot`, `enableMemory`, `modelProvider`, `modelName`. Most users will pass even less.

---

## Potential Approaches

### Approach A: Capability Flags (Flat)

```typescript
const agent = createAgent({
  role: 'researcher',
  memory: true,       // injects memory tools
  team: true,         // injects team coordination tools
  durable: true,      // wraps tools with checkpoints
});
```

**Pros:** Simple, progressive disclosure works.
**Cons:** What about configuring those capabilities? `memory: true` is fine but what if you need `memory: { projectDir: '...' }`? Then we're back to nested config.

### Approach B: Convention + Overrides

```typescript
// 90% of users:
const agent = createAgent({ role: 'coder' });

// The agent discovers its capabilities at runtime:
// - sees .agntk/ dir → enables memory
// - workflow package installed → enables durability
// - task is complex → spawns sub-agents/teams
// - user's API key supports image models → can generate images

// 10% power users who need overrides:
const agent = createAgent({
  role: 'coder',
  memory: false,  // explicitly disable even though .agntk/ exists
  maxSteps: 50,   // override default
});
```

**Pros:** Zero-config by default. Agent is smart enough to figure it out.
**Cons:** Magic behavior can be surprising. "Why did it spawn a team?"

### Approach C: Role-Based Presets with Escape Hatches

```typescript
// Roles bundle sensible defaults:
const agent = createAgent({ role: 'researcher' });
// researcher role → memory on, team capable, reflective, standard tools

const agent = createAgent({ role: 'coder' });
// coder role → memory on, full tools, no team needed for most tasks

const agent = createAgent({ role: 'orchestrator' });
// orchestrator role → team on, delegation tools, synthesis

// Escape hatch for anything:
const agent = createAgent({
  role: 'coder',
  override: { memory: false },
});
```

**Pros:** Most users just pick a role. Power users can override.
**Cons:** Roles become a hidden config layer. What role is "generate me an image"?

### Approach D: Agent Decides Everything (Most Radical)

```typescript
const agent = createAgent();
// No role. No config. The agent reads the prompt and decides:
// - what tools it needs
// - whether to spawn sub-agents
// - whether to use memory
// - what model to use for each sub-task
```

**Pros:** Ultimate simplicity. One line.
**Cons:** Unpredictable cost. May use expensive models or spawn many agents. Hard to test/debug. Probably too magical.

---

## Team Coordination Specifically

Current `createTeam()` requires the user to define lead, members, tasks, and synthesis. This is backwards — the user shouldn't be the orchestrator.

### What We Want

The agent itself should decide when and how to use teams:

1. User gives a complex prompt
2. Lead agent (the one created by `createAgent()`) analyzes complexity
3. If task benefits from decomposition, agent uses `team_plan` tool to create a task board
4. Agent spawns specialists (sub-agents) using existing `spawn_agent` mechanism
5. Specialists claim tasks, communicate via messaging, complete work
6. Lead agent synthesizes results

This means `createTeam()`, `TaskBoard`, `machines.ts`, `tools.ts` become **internal implementation details** — invoked by the agent's team coordination tools, never by the user.

The user's interface is just:
```typescript
const agent = createAgent({ role: 'researcher' });
const result = await agent.generate({ prompt: 'Research quantum computing advances in 2025 and write a report' });
// Under the hood, the agent may or may not have spawned a team — user doesn't care
```

---

## Future Capabilities (Images, Video, Audio, Sandbox)

These should NOT be config flags. They should be **tools** that get registered based on:
1. What's available in the environment (API keys, installed packages)
2. What the role permits
3. What the agent decides it needs at runtime

```typescript
// NOT this:
createAgent({ capabilities: ['images', 'video'] });

// Instead, the agent discovers it can generate images because:
// - OPENAI_API_KEY is set (dall-e access)
// - or image generation tools are in the tool preset
// - Agent decides to use them when the task calls for it
```

---

## Pipeline/Parallel as Agent Behavior, Not User Config

`createPipeline()` and `createParallel()` shouldn't be user-facing factories. They should be patterns the agent can use internally:

```typescript
// User doesn't do this:
const pipeline = createPipeline({ steps: [researcher, writer] });

// Instead:
const agent = createAgent({ role: 'researcher' });
const result = await agent.generate({ prompt: 'Research and write a report on X' });
// The agent decides to: research first, then write (sequential internally)
// Or: research multiple angles in parallel, then synthesize
```

---

## Open Questions

1. **How much should the agent auto-decide vs. user control?** Too much magic = unpredictable costs and behavior. Too little = configuration hell.

2. **Should `role` be the primary (or only) config?** Roles could bundle all the smart defaults, and everything else is an override.

3. **How do we handle cost control?** If the agent can spawn teams and use expensive models, users need some guardrails on spend (maxSteps, maxTokens, maxAgents).

4. **Testing and reproducibility.** Agents that auto-decide behavior are harder to test. Need deterministic overrides for testing.

5. **What's the minimum viable config surface?** What's the smallest set of options that covers 95% of use cases without being limiting?

6. **How does this affect the sub-path exports?** If `createTeam()` becomes internal, does `@agntk/core/workflow` still make sense as a public API?

---

## Existing Patterns — What's Already Right

Not everything needs to change. Two files already follow the correct patterns and serve as reference implementations for the refactor.

### `reflection.ts` — The Gold Standard for Capabilities

Reflection is wired exactly how all capabilities should work:

- **Config option on `createAgent()`:** `createAgent({ reflection: { strategy: 'periodic', frequency: 5 } })`
- **Uses native AI SDK hook:** `prepareStep` — no extra LLM calls, no wrapper, no separate factory
- **Internal to the agent:** The user enables it with a flag. The agent handles the rest.
- **Progressive disclosure:** `reflection: { strategy: 'reflact' }` is all most users need. `frequency` and `promptTemplate` are there for power users.
- **Zero overhead when disabled:** `strategy: 'none'` returns a no-op. No code runs.

**This is the template** for how `durable`, `team`, `sandbox`, and future capabilities should be wired into `createAgent()`.

### `wrappers/best-of-n.ts` — Correct Pattern for Execution Strategies

Best-of-N is a **per-call utility**, not an agent capability:

```typescript
const result = await withBestOfN(agent, prompt, { n: 3, judgeModel, criteria });
```

This is correct because:
- The judge model and criteria change per prompt — you can't configure this at agent creation time
- It's an execution strategy (like `Promise.race`), not an agent type
- It lives in `@agntk/core/advanced` — power users opt in, it's not in the core path
- It doesn't create a new kind of agent — it takes an existing agent and runs it N times

**Lesson:** Not everything belongs on `createAgent()`. Per-call strategies that need per-call config should stay as standalone utilities.

### Pattern Classification

| Pattern | Example | Where it belongs |
|---------|---------|-----------------|
| **Agent capability** (always-on per agent) | reflection, memory, durable, team | Config option on `createAgent()` |
| **Execution strategy** (per-call, needs per-call config) | best-of-n, with-retry | Standalone utility in `@agntk/core/advanced` |
| **Internal implementation** (user never touches) | TaskBoard, pipeline, parallel, HookRegistry | Private to the SDK, used by agent internals |
| **Separate factory** (WRONG) | createDurableAgent, createTeam, createPipeline | Should not exist as public API |

---

## Observability & Agent Management

### Current State

`observability/` is a thin Langfuse wrapper (~130 lines). It's:
- **Not wired into `createAgent()` at all** — user must call `initObservability()` manually
- **Langfuse-only**, cloud-only by default (supports self-hosted via `baseUrl` override)
- **Not used by the CLI**

### The Real Problem: Multi-Agent Visibility

When users run long-lived or background agents:
```bash
npx agntk "watch this folder and organize new files as they appear"
npx agntk "send me a Slack message when the build finishes"
npx agntk "monitor this API endpoint and alert on errors"
```

They need to see: what agents are running, what they're doing, what they've done, how much they've spent. That's not a Langfuse problem — that's **local agent process management**.

### Two Layers (Don't Confuse Them)

**Layer 1: Agent Registry / Process Management (build this)**

Lightweight, local, zero external deps. Think `pm2` or `docker ps`, not Datadog.

- When `npx agntk` runs, register in `~/.agntk/agents.json` (pid, agentId, prompt, status, started_at, cost_so_far)
- `npx agntk status` — show all running/recent agents
- `npx agntk logs <agentId>` — tail an agent's log
- `npx agntk stop <agentId>` — graceful shutdown
- `npx agntk dashboard` — lightweight local web UI reading from the same registry
- Auto-cleanup: remove stale entries for dead PIDs

This is what users actually need for the multi-agent-on-one-machine use case. It's process management, not deep tracing.

**Layer 2: Deep Tracing / Debugging (plug into existing tools)**

For power users who want token-level traces, span trees, cost breakdowns, prompt/completion logging:

- Langfuse (self-hosted or cloud)
- Braintrust, Arize, LangSmith, etc.
- AI SDK already emits OpenTelemetry spans — just register a provider

This should remain **optional and provider-agnostic**. Don't build our own tracing platform. Don't couple to Langfuse specifically.

### How It Should Work

```bash
# Layer 1 — always available, zero config
npx agntk status
# AGENT-a1b2  running  2m ago   "watch folder /tmp/uploads"    $0.03
# AGENT-c3d4  running  15m ago  "monitor API health"           $0.12
# AGENT-e5f6  done     1h ago   "organize downloads"           $0.08

npx agntk dashboard
# Opens http://localhost:4321 — simple web UI showing same info + logs

# Layer 2 — opt-in for deep tracing
LANGFUSE_PUBLIC_KEY=pk-... LANGFUSE_SECRET_KEY=sk-... npx agntk "do something"
# or with local Langfuse:
LANGFUSE_BASEURL=http://localhost:3000 npx agntk "do something"
```

### Open Questions

1. **Should the agent registry be a daemon or file-based?** A daemon (like `pm2`) is more robust but heavier. File-based (`agents.json` + PID checking) is simpler but has race conditions.

2. **How does the local dashboard work?** Embedded web server in the CLI? Separate package? Just a terminal UI (like `htop`)?

3. **Should `createAgent()` auto-register?** Or only when run via the CLI? SDK users calling `createAgent()` programmatically might not want registry side-effects.

4. **Cost tracking** — where do token counts / costs get aggregated? The AI SDK provides usage per call, but who sums it up per agent?

5. **Should we auto-detect local Langfuse?** If `localhost:3000` responds with a Langfuse API, auto-connect? Feels fragile.

---

## Full Codebase Review — Directory Health Summary

Complete review of all directories in `packages/sdk/src/` (February 2025).

### Directory Health Matrix

| Directory | Files | Health | Key Finding |
|-----------|-------|--------|-------------|
| `agent.ts` | 1 | 🟡 Yellow | Kitchen-sink orchestrator, 10+ subsystem imports, fragile memory injection |
| `config/` | 4+2 tests | 🟡 Yellow | Global singleton, unused CustomProvider schema, shallow env var coverage |
| `constants.ts` | 1 | 🔴 Red | Stale vectra/brain references (DEAD-005) |
| `evals/` | 4 | 🟢 Green | Clean, well-tested, independent module. Correctly separate from createAgent |
| `guardrails/` | 4 | 🟢 Green | Well-integrated into createAgent. Minor filter chaining issue (DESIGN-004) |
| `index.ts` | 1 | 🟡 Yellow | Logger re-export from wrong source (BUG-001) |
| `memory/` | 5 | 🟢 Green | Rewritten in Phase 2. Markdown-based, working |
| `models.ts` | 1 | 🟡 Yellow | Repetitive tier functions, questionable Anthropic wrapper (DESIGN-003) |
| `observability/` | 3 | 🔴 Red | Not wired into anything (CLEAN-001) |
| `pool/` | 4 | 🟡 Yellow | Works but memory leak in long-running specialists (DESIGN-007) |
| `presets/` | 2 | 🟡 Yellow | Duplicate role prompts with prompts/templates.ts (DUP-001) |
| `prompts/` | 2 | 🟡 Yellow | Duplicate role prompts with presets/roles.ts (DUP-001) |
| `reflection.ts` | 1 | 🟢 Green | Gold standard. Uses prepareStep hook. |
| `skills/` | 2 | 🟢 Green | Clean SKILL.md discovery, weighted search, compatibility with skills.sh |
| `streaming/` | 3 | 🔴 Red | Entirely dead code — helpers never called, not wired in (DEAD-003) |
| `tools/` | 20+ | 🟢 Green | Well-designed tools with safety checks. In-memory state loss concern (DESIGN-005) |
| `tools/provider.ts` | 1 | 🔴 Red | Factory/Registry unused (DEAD-004) |
| `types/` | 4 | 🟡 Yellow | Duplicate StreamEvent definitions (DUP-002), config explosion risk |
| `usage-limits.ts` | 1 | 🟢 Green | Clean, minimal, correctly integrated |
| `utils/logger.ts` | 1 | 🔴 Red | Duplicate of @agntk/logger (BUG-001) |
| `workflow/` | 17 | 🔴 Red | Almost entirely dead code in CLI path (DEAD-001, DEAD-002) |
| `wrappers/` | 1 | 🟢 Green | best-of-n correct as standalone utility |

### What's Working Well

1. **Guardrails** — Clean 4-file design, properly integrated into createAgent, parallel execution, multiple strategies
2. **Evals** — Independent, well-tested evaluation framework with concurrency control and reporter pattern
3. **Reflection** — Gold standard for capability integration via AI SDK hooks
4. **Skills** — SKILL.md discovery with skills.sh compatibility, weighted search
5. **Tool safety** — Dangerous command blocking, path traversal prevention, workspace sandboxing
6. **Memory (Phase 2)** — Markdown-based, working end-to-end with CLI

### What Needs Attention (Prioritized)

**Delete immediately (dead code):**
1. `utils/logger.ts` + fix `index.ts` re-exports (BUG-001)
2. `constants.ts` stale references (DEAD-005)
3. `tools/provider.ts` unused factory/registry (DEAD-004)

**Consolidate (duplications):**
4. Role prompts — pick one source of truth (DUP-001)
5. StreamEvent types — use streaming.ts versions only (DUP-002)

**Design fixes (medium priority):**
6. `agent.ts` memory injection — fix race condition, remove type coercion (DESIGN-001)
7. Symlink path traversal in file tools (DESIGN-006)
8. Config global singleton → dependency injection (DESIGN-002)

**Feature gaps (lower priority):**
9. Streaming module — either integrate into createAgent or document as advanced-only
10. Observability — implement Layer 1 (agent registry) per design above
11. Tool state persistence — progress/plan/reasoning should survive restarts

### Tools Inventory

The tool system is the SDK's strongest area. Here's what exists:

| Tool | Type | Safety | Notes |
|------|------|--------|-------|
| `glob` | File discovery | Workspace-scoped | ripgrep backend with fallback |
| `grep` | Content search | Workspace-scoped | ripgrep backend with fallback |
| `ast_grep_search/replace` | AST-aware code search | Dry-run default | 25 languages supported |
| `shell` | Command execution | Dangerous pattern blocking | Background process support |
| `file_read/write/edit/create` | File operations | Path validation | No symlink resolution |
| `spawn_agent` | Sub-agent delegation | Depth-limited | Streaming output capture |
| `plan_tool` | Task planning | None | In-memory only, delegation threshold |
| `deep_reasoning` | Multi-step thinking | None | In-memory only, branching |
| `progress_read/update` | Session tracking | None | File-persisted |
| `search_skills` | Skill discovery | None | Cached with mtime invalidation |
| `browser` | Web automation | None | Requires external agent-browser binary |
| `spawn_specialist/list_specialists` | Specialist pool | None | LRU+TTL cache, via @agntk/core/advanced |
| `remember/recall/update_context/forget` | Memory tools | None | Markdown-based (Phase 2) |

---

## Related Roadmap Items

- **Phase 3.1:** Remove `createDurableAgent()`, make `durable` a config option *(partially done)*
- **Phase 3.4:** Team coordination with pluggable backends
- **Deferred:** `"use sandbox"` directive
- **Rejected:** Container-per-agent isolation, wrapper explosion pattern
- **Architectural Decision:** Directive pattern over wrapper pattern (`"use step"`, `"use sandbox"`)

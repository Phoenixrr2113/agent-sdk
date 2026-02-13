# Fixes & Issues

> Tracked issues discovered during codebase review.
> Completed items from Phases 1-6 have been archived.

---

## Open

### DESIGN-002: Config global singleton

**Status:** ⏳ Deferred

The lazy singleton (`let globalConfig`) is acceptable for current single-process usage. `createAgent()` uses explicit options; subsystems only use `getConfig()` as a fallback. Revisit when multi-agent-per-process becomes a pattern.

### DESIGN-004: Workflow sub-factories publicly exported

**Status:** 🔵 In progress — superseded by architecture change

`workflow/index.ts` publicly exports `createTeam()`, `createPipeline()`, `createParallel()`, `createScheduledWorkflow()`, etc. Per the new agent architecture (UNIFIED-AGENT-DESIGN.md), these become internal implementation details. The `@agntk/core/workflow` sub-path will be internalized. Only hook-related exports needed by `@agntk/server` will remain accessible.

Tracked as P5-ARCH-002 in TASKS.yaml.

### DEAD-009: XState machines unused

**Status:** 🔴 Delete

`teamCoordinationMachine` and `teammateMachine` in `workflow/team/machines.ts` are imported in `create-team.ts` but never referenced in the function body. The actual `createTeam` implementation uses imperative code. These are dead code. Also publicly exported from `@agntk/core/workflow` with zero external consumers.

Tracked as part of P5-ARCH-002 in TASKS.yaml.

### DEAD-010: Zero-consumer workflow exports

**Status:** 🔴 Delete

The following are publicly exported but have zero consumers anywhere (not even tests):
- `createWebhook`
- `getWdkErrors`
- `wrapToolAsIndependentStep`
- `getDurabilityConfig`
- `getStepName`
- `DURABILITY_CONFIG`

Tracked as part of P5-ARCH-002 in TASKS.yaml.

---

## Completed (Phase 1-6 Archive)

<details>
<summary>Click to expand completed items</summary>

- **BUG-001:** `utils/logger.ts` shadows `@agntk/logger` exports — ✅ Fixed (Phase 3)
- **CLEAN-001:** `observability/langfuse.ts` not wired in — ✅ Fixed (Phase 5)
- **DEAD-001:** `workflow/durable-agent.ts` factory — ✅ Deleted (Phase 4b)
- **DEAD-002:** `workflow/hooks.ts` — ❌ Not dead, removed from tracking
- **DEAD-003:** `streaming/transient.ts` — ✅ Annotated (Phase 4a)
- **DEAD-004:** Deprecated aliases — ✅ Deleted (Phase 4b)
- **DEAD-005:** Convenience agent factories — ✅ Deleted (Phase 6)
- **DEAD-006:** Orphaned constants — ✅ Deleted (Phase 6)
- **DEAD-007:** Unused model utilities — ✅ Deleted (Phase 6)
- **DEAD-008:** `streaming/` directory — ✅ Deleted (Phase 6)
- **SMELL-001:** `as unknown as` hack — ✅ Fixed (Phase 6)
- **DESIGN-003:** Repetitive tier functions + Anthropic wrapper — ✅ Fixed (Phase 4a)

</details>

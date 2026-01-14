# SDK Package Improvements

## Status Overview

| Area | Status | Notes |
|------|--------|-------|
| Role/Tool Registries | ✅ Done | `role-registry.ts`, config loading, templates |
| Config System | ✅ Done | JSON/YAML, env vars, cascading |
| Debug Logging | ✅ Done | `@agent/logger` across all packages |
| Transient Streaming | ✅ Done | Data parts, specialized writers |
| WebSocket Streaming | ✅ Done | `AgentWebSocketClient` |
| Durable Agent Types | ✅ Done | Options interface ready |
| **SSE HTTP Streaming** | ❌ TODO | Client needs async generators |
| **Memory → Context** | ❌ TODO | Auto-load preferences |
| **Workflow Runtime** | ⏸️ Deferred | Needs external package |

---

## Remaining Work

### 1. SSE Streaming (Medium Priority)
**File:** `packages/sdk-client/src/http-client.ts`

- [ ] Add `generateStream()` with AsyncGenerator
- [ ] Add `AbortController` for timeout/cancel
- [ ] Add stream event types

### 2. Memory → Context Integration (Low Priority)
**File:** `packages/sdk/src/prompts/context.ts`

- [ ] Add `memoryStore` to `ContextOptions`
- [ ] Auto-load preferences from memory
- [ ] Tag-based filtering

### 3. Workflow Integration (Deferred)
**File:** `packages/sdk/src/workflow/`

> Intentionally deferred. Requires external workflow runtime (useworkflow.dev, Temporal, Inngest).

Current stubs provide API surface for future integration.

---

## Memory Evolution Roadmap

| Phase | Storage | Scale | Status |
|-------|---------|-------|--------|
| Current | Vectra/JSON | ~100K | ✅ Working |
| Phase 1 | JSONL Graph | ~100K | Future |
| Phase 2 | SQLite | ~10M | Future |
| Phase 3 | Neo4j/Zep | Billions | Future |

See `src/memory/FUTURE_IMPROVEMENTS.md` for details.

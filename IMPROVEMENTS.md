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
| **SSE HTTP Streaming** | ✅ Done | `generateStream()` with AsyncGenerator |
| **Memory → Context** | ✅ Done | Auto-load preferences via `loadPreferencesFromMemory()` |
| **Workflow Runtime** | ⏸️ Deferred | Needs external package (Temporal, Inngest, etc.) |
| **Agent Dashboard** | ✅ Done | Next.js 15 + Tailwind 4 |

---

## Completed Work (Jan 2026)

### SSE Streaming
**File:** `packages/sdk-client/src/http-client.ts`

- [x] Add `generateStream()` with AsyncGenerator
- [x] Add `AbortController` for timeout/cancel
- [x] Add stream event types

### Memory → Context Integration
**File:** `packages/sdk/src/prompts/context.ts`

- [x] Add `memoryStore` to `ContextOptions`
- [x] Auto-load preferences from memory via `loadPreferencesFromMemory()`
- [x] Tag-based filtering

### Agent Dashboard
**Location:** `apps/dashboard`

- [x] Log Viewer with SSE streaming
- [x] Chat Panel for testing prompts
- [x] Config Editor for role/tool management
- [x] Status Panel for health monitoring

---

## Deferred Work

### Workflow Integration
**File:** `packages/sdk/src/workflow/`

> Intentionally deferred. Requires external workflow runtime (useworkflow.dev, Temporal, Inngest).

Current stubs provide API surface for future integration. See `AGENT_INTEGRATION_TODO.md`.

---

## Memory Evolution Roadmap

| Phase | Storage | Scale | Status |
|-------|---------|-------|--------|
| Current | Vectra/JSON | ~100K | ✅ Working |
| Phase 1 | JSONL Graph | ~100K | Future |
| Phase 2 | SQLite | ~10M | Future |
| Phase 3 | Neo4j/Zep | Billions | Future |

See `src/memory/FUTURE_IMPROVEMENTS.md` for details.

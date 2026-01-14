# SDK Package Improvements

## Overview

Consolidated TODO/Future Improvements across the agent-sdk monorepo.

---

## @agent/sdk (Core)

### [ ] Memory System Evolution
**File:** `src/memory/FUTURE_IMPROVEMENTS.md`

| Phase | Storage | Native Deps | Scale | Effort |
|-------|---------|-------------|-------|--------|
| Current | Vectra/JSON | ❌ None | ~100K | Now |
| Phase 1 | JSONL Graph | ❌ None | ~100K | 1 week |
| Phase 2 | SQLite | ✅ better-sqlite3 | ~10M | 2 weeks |
| Phase 3 | Neo4j/Zep | ✅ External DB | Billions | TBD |

### [ ] Presets Configuration
**File:** `src/presets/CONFIGURATION_TODO.md`

- [ ] Sub-agent config customization (custom roles, tool presets)
- [ ] Role/prompt customization (override defaults, add custom roles)
- [ ] Prompt template variables support
- [ ] Config file support (JSON or SDK factory options)

### [ ] Memory Integration for Prompts
**File:** `src/prompts/MEMORY_INTEGRATION_TODO.md`

- [ ] Memory store integration in context builder
- [ ] Tag-based preference filtering
- [ ] Preference extraction/parsing from memory
- [ ] Caching strategy for preferences

### [ ] Workflow Agent Factory Unification
**File:** `src/workflow/AGENT_INTEGRATION_TODO.md`

- [ ] Add durability options to `src/types/agent.ts`
- [ ] Update `createDurableAgent` to call `createAgent` internally
- [ ] Integrate `wrapToolAsDurableStep` into tool building
- [ ] Add `durable: boolean` option to `createAgent`
- [ ] Connect workflow sleep/webhook to real workflow package
- [ ] Add integration tests
- [ ] Update documentation

---

## @agent/sdk-client & @agent/sdk-server

### [ ] Client/Server Streaming Enhancement
**File:** `ENHANCEMENT_PLAN.md`

#### Phase 1: Essential
- [ ] HTTP client: SSE streaming with AsyncGenerator
- [ ] HTTP client: Timeout/abort handling
- [ ] Types: Full stream event types
- [ ] Server: AI SDK response integration

#### Phase 2: Convenience
- [ ] Client: Callbacks wrapper
- [ ] Client: Session management
- [ ] Server: Middleware (auth, logging)
- [ ] Server: WebSocket support

#### Phase 3: Polish
- [ ] Tests for client
- [ ] Tests for server
- [ ] Documentation
- [ ] Examples

---

## Priority Assessment

| Area | Complexity | Impact | Suggested Order |
|------|------------|--------|-----------------|
| Workflow Unification | Medium | High | 1st - Fixes broken stubs |
| Client SSE Streaming | Medium | High | 2nd - Essential for real usage |
| Presets Configuration | Low | Medium | 3rd - Developer experience |
| Memory Integration | Medium | Medium | 4th - Context personalization |
| Memory Evolution | High | High | Later - Requires design decisions |

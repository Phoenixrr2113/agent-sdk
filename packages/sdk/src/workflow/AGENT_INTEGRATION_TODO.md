# Workflow Integration - Deferred

## Status: ⏸️ Intentionally Deferred

The workflow integration requires an external workflow runtime. The current stubs provide a stable API surface for future integration.

## Why Stubs?

The `"use workflow"` directive and related functions (`workflowSleep`, `waitForWebhook`) require a workflow runtime such as:

- **useworkflow.dev** - Vercel's workflow package
- **Temporal** - Durable workflow orchestration
- **Inngest** - Event-driven durable functions

Without a runtime, the code cannot actually:
- Checkpoint and resume on crash
- Sleep without holding compute
- Wait for webhooks

## Current API Surface

The following API is stable and ready for integration:

| Function | Status | Purpose |
|----------|--------|---------|
| `createDurableAgent()` | ✅ Stub | Factory for durable agents |
| `wrapToolAsDurableStep()` | ✅ Stub | Wrap tools for durability |
| `parseDuration()` | ✅ Working | Parse "30s", "5m", etc. |
| `formatDuration()` | ✅ Working | Format ms to human string |

## Integration Path

When ready to integrate:

1. Add workflow runtime dependency (e.g., `workflow`)
2. Replace `workflowSleep()` with actual import
3. Replace `waitForWebhook()` with actual implementation
4. Update `createDurableAgent.generate()` to call real agent

## Files

| File | Purpose |
|------|---------|
| `durable-agent.ts` | Agent factory with workflow methods |
| `durable-tool.ts` | Tool wrappers for durability |
| `index.ts` | Exports |

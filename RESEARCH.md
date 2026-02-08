# Agent SDK — Research & Adoption Tracker

What we've researched and plan to adopt into `@agent/sdk`.

---

## Vercel AI Elements

**Source:** [github.com/vercel/ai-elements](https://github.com/vercel/ai-elements) | [elements.ai-sdk.dev](https://elements.ai-sdk.dev)

**What it is:** 48 pre-built React components on the shadcn/ui registry, designed for AI-native apps. Installed as source code (you own the files). Built for `@ai-sdk/react`'s `useChat` hook — the same streaming format our `@agent/sdk` produces.

**Why adopt:** Native fit. No protocol translation, no extra dependencies. We're already on AI SDK v6. These components are purpose-built for exactly our streaming format.

**Components to use:**

| Component | Maps to our stuff |
|-----------|-------------------|
| `conversation` + `message` + `prompt-input` | Replaces our basic ChatPanel |
| `tool` | Renders our 14+ brain tool invocations inline |
| `terminal` | Displays `shellExecute` tool output |
| `file-tree` | Repo map / code context from brain |
| `code-block` | Code analysis tool output |
| `chain-of-thought` / `reasoning` | Agent multi-step thinking |
| `plan` + `task` + `checkpoint` | Brain episode planning and task execution |
| `confirmation` | Human-in-the-loop approval for dangerous tools |
| `model-selector` | Our cascading config (openrouter/ollama/openai) |
| `persona` | Agent role identity display |
| `node` + `edge` | Brain knowledge graph visualization |
| `sources` | Knowledge graph citation display |
| `workflow` | Agent tool chain execution visualization |
| `suggestion` | Agent-suggested actions |
| `shimmer` | Streaming loading states |
| `stack-trace` | Agent error debugging |
| `schema-display` | Brain graph schema display |

**Install method:**
```bash
npx ai-elements@latest              # all components
npx ai-elements@latest add message  # specific component
```

**Decision:** Replaces CopilotKit entirely. The AI SDK full ecosystem (SDK v6 + AI Elements + `useChat`) covers everything CopilotKit/AG-UI would provide, without protocol adapters or extra abstraction layers. CopilotKit/AG-UI solve the problem of connecting *someone else's* agent to your frontend — we own both sides.

---

## NanoClaw Patterns

**Source:** [github.com/gavrielc/nanoclaw](https://github.com/gavrielc/nanoclaw)

**What it is:** ~7-file personal Claude assistant. WhatsApp I/O → isolated containers running Claude Agent SDK. Per-group memory, cron scheduler, filesystem IPC.

### Adopt: Container Sandbox Runner ⭐

Each agent invocation runs inside a Linux container (Apple Container / Docker) with explicit volume mounts. Our SDK currently runs all tools in-process with no isolation.

**What to build:** A `ContainerRunner` / `SandboxAdapter` for `@agent/sdk` that:
- Optionally sandboxes agent tool execution (especially `shellExecute`, file writes)
- Uses Apple Container (macOS) or Docker (Linux) as runtime
- Explicit volume mount allowlisting — agent sees only what's mounted
- Mount security: external allowlist at `~/.config/agent-sdk/mount-allowlist.json` (outside project, tamper-proof)
- Non-privileged contexts forced read-only
- Blocked patterns (`.ssh`, `.gnupg`, `.env`)
- Timeout + max output size limits
- Sentinel markers for parsing structured output from noisy container stdout

**Integration point:** `createAgent({ sandbox: 'container' })` or `createAgentServer({ sandbox: true })`

### Adopt: Task Scheduler ⭐

Cron/interval/one-shot scheduled tasks that invoke the agent autonomously. NanoClaw stores tasks in SQLite, polls for due tasks.

**What to build:** A `TaskScheduler` for `@agent/sdk-server`:
- Schedule types: `cron`, `interval`, `once`
- Runs agent prompts on schedule (e.g., "summarize commits every Friday")
- Logs run results: duration, status, error, result summary
- Supports pause/resume/cancel
- Context modes: `isolated` (fresh session) or `group` (continues previous session)
- CRUD endpoints: `POST /tasks`, `GET /tasks`, `PATCH /tasks/:id`, `DELETE /tasks/:id`
- Scheduler loop polls for due tasks at configurable interval

**Dependencies:** `cron-parser` for cron expressions, persistence adapter (SQLite or our existing brain)

### Adopt: Concurrency Queue ⭐

`GroupQueue` class: concurrency limits, per-group serialization, retry with exponential backoff, graceful shutdown.

**What to build:** A `RequestQueue` for `@agent/sdk-server`:
- Max concurrent agent runs (`MAX_CONCURRENT_AGENTS`)
- Per-session serialization (same session = sequential, different sessions = parallel)
- Retry with exponential backoff (base 5s, max 5 retries)
- Graceful shutdown: drain active runs, SIGTERM → grace period → SIGKILL
- Priority: tasks before messages
- Prevents duplicate queue entries

**Integration point:** Wraps all `/generate`, `/stream`, `/chat` handlers

### Skip

| NanoClaw thing | Why skip |
|---------------|----------|
| WhatsApp/baileys | Channel-specific, not SDK concern |
| Claude Agent SDK coupling | We use Vercel AI SDK |
| SQLite directly | We have FalkorDB (brain) and flexible adapters |
| Filesystem IPC | We have HTTP/SSE which is better |
| `CLAUDE.md` per-group memory | We have `@agent/brain` (knowledge graph, episodic memory) — far more capable |

### Adopt: Skills System (Markdown Playbooks) ⭐⭐

NanoClaw's best idea. Skills are **not code** — they're structured markdown instructions that an agent reads and executes. Each skill is a directory with a `SKILL.md` file:

```
.agent/skills/
├── add-gmail/
│   └── SKILL.md          # Step-by-step: modify code, ask user questions, test
├── setup/
│   └── SKILL.md          # Full onboarding walkthrough
└── convert-to-docker/
    └── SKILL.md          # Transform the project to use Docker
```

**How it works — progressive disclosure:**
1. `SKILL.md` has YAML frontmatter with `name` and `description`
2. Agent sees the description first (cheap — just metadata, no token cost)
3. If relevant, agent loads the full `SKILL.md` and follows the instructions
4. Skills can reference additional files in their directory for complex tasks

**Example — `/add-gmail` skill (real NanoClaw code):**
```markdown
---
name: add-gmail
description: Add Gmail integration to NanoClaw
---
# Add Gmail Integration
Ask the user: Tool Mode or Channel Mode?

## Tool Mode Implementation
### Step 1: Add Gmail MCP to Agent Runner
Read `container/agent-runner/src/index.ts`, find `mcpServers`, add:
```typescript
gmail: { command: 'npx', args: ['-y', '@gongrzhe/server-gmail-autoauth-mcp'] }
```
### Step 2: Mount credentials in container
### Step 3: Update group memory
### Step 4: Rebuild and restart
### Step 5: Test
```

**Why this is powerful:**
- **Skills don't add features — they teach the agent how to add features.** The skill file tells the agent which files to modify, what code to insert, what to ask the user, and how to verify.
- **Zero runtime cost** — unused skills consume no tokens, no memory, no bundle size
- **Shareable** — community can contribute skills as PRs without touching core code
- **Self-documenting** — the skill IS the documentation
- **Progressive disclosure** — agent only loads what's relevant to the current task

**How we adapt this for `@agent/sdk`:**

Our agents already support a `systemPrompt`. Skills extend this with **on-demand capability loading**:

```typescript
const agent = createAgent({
  role: 'coder',
  toolPreset: 'standard',
  skills: ['./skills/deploy-vercel', './skills/setup-db'],
  // Agent sees skill descriptions in system prompt
  // Loads full SKILL.md content only when the task matches
});
```

**Key difference from NanoClaw:** They use skills to modify the codebase itself ("fork and customize"). We use skills as **runtime capability packages** — the agent reads the skill and gains domain knowledge + step-by-step instructions for a specific capability, without modifying SDK source code.

**Skill format for our SDK:**
```
skills/
├── deploy-vercel/
│   ├── SKILL.md           # Instructions agent follows
│   ├── templates/          # Optional: file templates
│   └── examples/           # Optional: reference code
├── setup-postgres/
│   └── SKILL.md
└── analyze-codebase/
    ├── SKILL.md
    └── prompts/            # Sub-prompts for specific phases
```

---

## Vercel Workflow DevKit

**Source:** [useworkflow.dev](https://useworkflow.dev) | `npm i workflow @workflow/ai`

**What it is:** Vercel's durable execution framework for TypeScript. Makes any async function crash-proof, resumable, and observable using two directives: `"use workflow"` (orchestrator, sandboxed, deterministic) and `"use step"` (worker, full Node.js access, auto-retry). Built by Vercel specifically to pair with AI SDK.

**Why it matters for us:** Our agents run multi-step tool chains that can take minutes. If the server crashes mid-chain, everything is lost. Workflow DevKit makes the entire agent run durable — every tool call is a step that's persisted to an event log. If the process dies, it replays from the last completed step.

### Adopt: DurableAgent Wrapper ⭐⭐

`@workflow/ai` provides `DurableAgent` — a drop-in replacement for AI SDK's `Agent` that wraps every LLM call and tool execution as a workflow step. Our `createAgent()` already returns an AI SDK agent. Wrapping it in `DurableAgent` gives us:

- **Crash recovery** — agent resumes from last completed tool call, not from scratch
- **Automatic retry** — failed tool calls retry up to 3x by default (configurable)
- **Step-level observability** — every LLM call and tool invocation is a discrete, inspectable step
- **Event sourcing** — full replay log of every step result, stored to disk

```typescript
// Before: our current pattern
const result = await streamText({ model, tools, maxSteps: 10, ... });

// After: durable version
export async function agentWorkflow(messages: ModelMessage[]) {
  "use workflow";
  const writable = getWritable<UIMessageChunk>();
  const agent = new DurableAgent({ model, tools, system: prompt });
  await agent.stream({ messages, writable });
}
```

**Integration point:** Wrap our `createAgent()` factory to optionally return a `DurableAgent`. Or add a separate `createDurableAgent()` export.

### Adopt: Resumable Streams ⭐⭐

Streams that survive page refreshes, network interruptions, and server restarts. `WorkflowChatTransport` replaces the default `useChat` transport:

- Server returns `x-workflow-run-id` header on first request
- Client stores run ID and uses it to reconnect to the same stream
- On reconnect, server replays from where client left off
- Zero data loss — works across refreshes, tab switches, mobile app backgrounding

**Integration point:** Our `@agent/sdk-server` Hono endpoints return a run ID. Our `@agent/sdk-client` uses `WorkflowChatTransport` in `useChat`.

### Adopt: Hooks & Webhooks (Suspend/Resume) ⭐⭐

First-class suspension points in agent workflows:

- **`defineHook()`** — typed suspension point, workflow pauses until external data arrives. Zero compute while waiting.
- **`createWebhook()`** — generates a URL that, when hit, resumes the workflow with the POST payload.
- **`sleep("7 days")`** — deterministic delay, no resources consumed. Agent can literally wait a week and resume.

This is the real solution for **human-in-the-loop**: agent calls a tool that needs approval → creates a hook → workflow suspends → UI shows approval button → user approves → `resumeHook()` sends data → workflow resumes and tool completes.

```typescript
// Agent tool that pauses for human approval
async function executeBookingApproval({ flightNumber, price }, { toolCallId }) {
  const hook = approvalHook.create({ token: toolCallId });
  const { approved, comment } = await hook; // Workflow suspends here
  if (!approved) return `Rejected: ${comment}`;
  return `Approved for ${flightNumber}`;
}
```

**How it replaces NanoClaw's task scheduler:** Instead of polling SQLite for cron jobs, use `sleep()` + loops:
```typescript
export async function dailyBriefing() {
  "use workflow";
  while (true) {
    await generateBriefing();
    await sleep("24 hours"); // Suspends, no compute
  }
}
```

### Adopt: Built-in Observability ⭐

`npx workflow inspect runs --web` — local web UI showing every workflow run, every step, timing, inputs/outputs, errors. No external services needed.

- CLI: `npx workflow inspect runs` — list all runs
- Web UI: `--web` flag for visual exploration
- Event log stored locally (`.next/workflow-data/` by default)
- Each tool call visible as a discrete step with duration, retries, input/output

**This replaces ad-hoc logging.** Our current `@agent/logger` streams logs via SSE. Workflow DevKit gives structured, step-by-step observability automatically.

### Adopt: Hono Integration ⭐

Workflow DevKit supports Hono out of the box (our server uses Hono). Getting started:
```bash
npm i workflow @workflow/ai
```

Framework adapters: Next.js, Vite, Astro, Express, Fastify, **Hono**, Nitro, Nuxt, SvelteKit, NestJS.

### Impact on NanoClaw Patterns

Workflow DevKit **supersedes** two of the three NanoClaw patterns we planned to adopt:

| NanoClaw pattern | Workflow DevKit equivalent | Status |
|-----------------|--------------------------|--------|
| Task Scheduler (cron/interval) | `sleep()` + durable loops — no polling, no SQLite, suspends with zero compute | **Superseded** |
| Concurrency Queue | Workflow runtime handles step execution, retries, and scheduling natively | **Partially superseded** (still want max concurrency limits on our server) |
| Container Sandbox | No equivalent in WDK — still adopt from NanoClaw for tool isolation | **Still needed** |

---

## Vercel Agent Browser

**Source:** [github.com/vercel-labs/agent-browser](https://github.com/vercel-labs/agent-browser) | `npm i -g agent-browser`

**What it is:** Headless browser automation CLI designed specifically for AI agents. Rust CLI (fast) with Node.js fallback. Client-daemon architecture: Rust CLI parses commands → Node.js daemon manages Playwright browser instance. Daemon persists between commands for fast sequential operations.

**Why it matters for us:** Our agents currently have no way to interact with web pages. This gives us a `browseTool` that agents can shell out to — or we can use the programmatic `BrowserManager` API directly as a tool implementation.

### Adopt: Snapshot-Ref Workflow as Agent Tool ⭐⭐

The killer pattern: `snapshot` dumps the accessibility tree with ref IDs (`@e1`, `@e2`, etc.), then the agent uses those refs to interact. This is far more reliable than CSS selectors or XPath because:

- **Deterministic** — refs point to exact elements from the snapshot
- **AI-optimized** — accessibility tree is compact, semantic, and LLM-friendly
- **No DOM re-query** — refs map to already-found elements

```bash
# Agent workflow:
agent-browser open example.com
agent-browser snapshot -i --json     # Interactive elements only, JSON output
# LLM reads: heading "Example" [ref=e1], button "Submit" [ref=e2], textbox "Email" [ref=e3]
agent-browser fill @e3 "test@example.com"
agent-browser click @e2
agent-browser snapshot -i --json     # Re-snapshot after page change
```

**What to build:** A `browserTool` for `@agent/sdk` with these operations:
- `open(url)` — navigate
- `snapshot(options)` — get accessibility tree with refs (supports `interactive`, `compact`, `depth`, `selector` filters)
- `click(ref)` / `fill(ref, text)` / `select(ref, value)` — interact by ref
- `screenshot(path)` — visual capture
- `getText(ref)` / `getHtml(ref)` / `getValue(ref)` — extract content
- `wait(selector | ms | text | url | condition)` — wait for state
- `close()` — cleanup

### Adopt: Programmatic BrowserManager API ⭐

For direct tool integration (no shell spawning):

```typescript
import { BrowserManager } from 'agent-browser';

const browser = new BrowserManager();
await browser.launch({ headless: true });
await browser.navigate('https://example.com');
// ... interact ...
```

This gives us an in-process browser instead of shelling out to the CLI.

### Adopt: Session Isolation ⭐

Multiple isolated browser instances with `--session`:
- Each session has its own cookies, storage, history, auth state
- Sessions named per agent run — prevents cross-contamination
- Persistent profiles with `--profile` for reusing login sessions

Maps directly to our multi-session agent architecture.

### Adopt: Streaming Browser Preview ⭐

WebSocket-based viewport streaming for live preview / "pair browsing":

```typescript
// Start screencast
await browser.startScreencast((frame) => {
  // frame.data = base64 JPEG, frame.metadata = viewport info
}, { format: 'jpeg', quality: 80, maxWidth: 1280, maxHeight: 720 });

// Inject mouse/keyboard events
await browser.injectMouseEvent({ type: 'mousePressed', x: 100, y: 200, button: 'left' });
await browser.injectKeyboardEvent({ type: 'keyDown', key: 'Enter', code: 'Enter' });
```

**Use case:** Stream what the agent's browser is doing to our dashboard UI in real-time. User watches the agent browse, can intervene via mouse/keyboard injection. Pairs perfectly with AI Elements' `workflow` component.

### Adopt: Provider Abstraction ⭐

Browser runtime is pluggable via `-p` flag:
- **Local** (default) — bundled Chromium via Playwright
- **Browserbase** — cloud browser infra for serverless/CI
- **Browser Use** — alternative cloud browser provider
- **Kernel** — cloud browser with stealth mode + persistent profiles
- **iOS Simulator** — real Mobile Safari via Appium (macOS + Xcode)
- **Serverless** — `@sparticuz/chromium` for Vercel/Lambda (~50MB)

**What to build:** Our `browserTool` should accept a `provider` config:
```typescript
createAgent({
  tools: [browserTool({ provider: 'local' })],        // default
  // or: browserTool({ provider: 'browserbase', apiKey: '...' })
  // or: browserTool({ provider: 'ios', device: 'iPhone 16 Pro' })
})
```

### Additional Features Worth Noting

| Feature | What it does |
|---------|-------------|
| Network interception | `network route <url> --body <json>` — mock API responses for testing |
| Auth state save/load | `state save/load <path>` — persist and restore login sessions |
| Console/errors | `console` / `errors` — capture browser JS errors for debugging |
| Trace recording | `trace start/stop` — Playwright trace for post-mortem debugging |
| CDP mode | Connect to existing Chrome/Electron/WebView2 via DevTools Protocol |
| Cookie management | Full CRUD on cookies and localStorage/sessionStorage |
| Dialog handling | `dialog accept/dismiss` — handle alerts, confirms, prompts |

### Skip

| Feature | Why skip |
|---------|----------|
| AI coding assistant integration (`npx skills add`) | We'll integrate directly via programmatic API |
| AGENTS.md / CLAUDE.md instructions | Not relevant — we're building native tool integration |
| Rust CLI binary | We'll use the Node.js `BrowserManager` API directly |

---

## Vercel JSON Render

**Source:** [github.com/vercel-labs/json-render](https://github.com/vercel-labs/json-render) | [json-render.dev](https://json-render.dev) | `npm i @json-render/core @json-render/react`

**What it is:** AI → JSON → UI engine. You define a **catalog** of components (with Zod-validated props), actions, and data bindings. AI generates constrained JSON specs. A `<Renderer>` turns those specs into React components. Supports streaming, conditional visibility, data binding, named actions, and code export to standalone React projects.

**Why it matters for us:** This is the missing piece for **generative UI** in our agent dashboard. Instead of the agent returning markdown text, it returns a JSON spec that renders as real interactive components — dashboards, charts, forms, metrics — all constrained to components we define.

### Adopt: Catalog-Based Generative UI ⭐⭐

The core pattern:

1. **Define catalog** — Zod-typed component registry with descriptions for the LLM
2. **Generate prompt** — `catalog.prompt()` auto-generates a system prompt with all available components/props/actions
3. **AI generates JSON** — structured output constrained to catalog schema
4. **Render** — `<Renderer spec={spec} registry={registry} />` renders React components

```typescript
// 1. Catalog — what the AI can use
const catalog = defineCatalog(schema, {
  components: {
    Card: { props: z.object({ title: z.string() }), description: "A card container" },
    Metric: { props: z.object({ label: z.string(), value: z.string(), format: z.enum(["currency", "percent"]) }) },
    Button: { props: z.object({ label: z.string(), action: z.string() }) },
  },
  actions: {
    export_report: { description: "Export dashboard to PDF" },
  },
});

// 2. Registry — actual React implementations
const { registry } = defineRegistry(catalog, {
  components: {
    Card: ({ props, children }) => <div className="card"><h3>{props.title}</h3>{children}</div>,
    Metric: ({ props }) => <div className="metric"><span>{props.label}</span><span>{props.value}</span></div>,
    Button: ({ props, onAction }) => <button onClick={() => onAction?.({ name: props.action })}>{props.label}</button>,
  },
});

// 3. Render AI output
<Renderer spec={aiGeneratedSpec} registry={registry} />
```

**Integration point:** Our agent tools (brain queries, code analysis, metrics) return structured data. Use json-render to let the AI compose visual layouts from those tool results. Build a catalog of dashboard components for the `@agent/sdk-client` dashboard.

### Adopt: SpecStream for Progressive Rendering ⭐

Stream and render UI as the model generates JSON:

```typescript
const compiler = createSpecStreamCompiler<MySpec>();
// Process chunks as they arrive from AI SDK stream
const { result, newPatches } = compiler.push(chunk);
setSpec(result); // UI updates progressively
```

Pairs perfectly with our existing SSE streaming. The dashboard renders partial UI while the agent is still thinking.

### Adopt: Data Binding ⭐

JSON Pointer-based data binding — components reference live data paths:

```json
{ "type": "Metric", "props": { "label": "Revenue", "value": "{{data.revenue}}" } }
```

Conditional visibility based on data or auth state:
```json
{ "type": "Alert", "visible": { "and": [{ "path": "/form/hasError" }, { "not": { "path": "/form/errorDismissed" } }] } }
```

**Use case:** Agent generates a dashboard spec that references live brain data. Components update when the underlying data changes — no re-generation needed.

### Adopt: Code Export ⭐

Export AI-generated UI as standalone React projects — no json-render runtime needed:

- Generates `package.json`, component files, styles
- Full standalone Next.js project
- User can customize the exported code freely

**Use case:** Agent designs a dashboard → user likes it → export as real code they own.

### Adopt: Named Actions ⭐

Actions defined in catalog, triggered by user interaction:
```typescript
actions: {
  export_report: { description: "Export dashboard to PDF" },
  refresh_data: { description: "Refresh all metrics" },
}
// Component: <button onClick={() => onAction?.({ name: "export_report" })}>
```

Actions flow back to our SDK — agent can handle them or route to tools.

### Consider: Remotion Video Renderer

`@json-render/remotion` — same catalog/spec pattern but renders to video timelines:
- Timeline-based specs with tracks, clips, composition settings
- AI generates video structure from prompts
- Components render as Remotion compositions

**Relevance:** Niche but interesting. Could enable agents that generate explainer videos, presentations, or data visualization animations from natural language.

### How It Fits with AI Elements

| Layer | Tool | Role |
|-------|------|------|
| Pre-built chat components | AI Elements | Conversation UI, tool rendering, code blocks |
| AI-generated dynamic layouts | json-render | Dashboards, widgets, forms from prompts |
| Streaming | Both | AI Elements streams chat, json-render streams UI specs |

They're complementary, not competing. AI Elements is the **shell** (chat, messages, tools). json-render is the **content inside tool results** (generated dashboards, dynamic widgets).

---

## ~~Kernel Browser Automation~~ — Skipped

**Source:** [onkernel.com](https://onkernel.com) | `@onkernel/sdk`

**What it is:** Cloud browser-as-a-service with stealth mode, CAPTCHA solving, persistent profiles, and an AI SDK tool (`playwrightExecuteTool`).

**Why we're skipping it:** `agent-browser` already gives us everything we need locally — full Playwright automation, session isolation, persistent profiles, live streaming, and a programmatic `BrowserManager` API. Kernel's value-adds (stealth, cloud VMs, massive parallelism) aren't problems we need to solve right now. If we ever do, agent-browser already supports Kernel as a provider via `-p kernel` — no separate SDK needed.

---

## DesktopCommanderMCP — Partially Relevant

**Source:** [github.com/wonderwhy-er/DesktopCommanderMCP](https://github.com/wonderwhy-er/DesktopCommanderMCP) | MIT License

**What it is:** MCP server providing terminal control, filesystem operations, and diff-based code editing to AI clients (Claude Desktop, ChatGPT). Core capabilities:
- **Process management:** `start_process`, `interact_with_process`, `read_process_output`, `force_terminate`, `list_sessions`
- **Filesystem:** `read_file` (with offset/length pagination, PDF/Excel/image support), `write_file`, `move_file`, `create_directory`, `list_directory`, `get_file_info`
- **Code editing:** `edit_block` with search/replace markers, fuzzy search fallback, character-level diffs
- **Search:** ripgrep-based content search with pagination (`start_search`, `get_more_search_results`)
- **Config:** Runtime config management, audit logging, Docker isolation

**Architecture:** Clean separation — `server.ts` is the MCP protocol layer (tool definitions + routing), `handlers/` modules contain the actual logic. The handlers are plain async functions that return `{ content: [...], isError: boolean }`. Extractable without MCP dependency.

### What We Already Have (No Action Needed)

| DesktopCommander | Our SDK | Notes |
|-----------------|---------|-------|
| `start_search` (ripgrep) | `grepTool` + `globTool` | Ours uses ripgrep too, same underlying binary |
| `read_file` (basic) | `shellTool` → `cat` / our fs tools | We have file reading covered |
| `write_file` | `shellTool` → `tee` / fs tools | We have file writing covered |
| `list_directory` | `globTool` / `shellTool` → `ls` | Covered |
| `move_file`, `create_directory` | `shellTool` | Covered via shell |
| `list_processes`, `kill_process` | `shellTool` → `ps`, `kill` | Covered via shell |
| Docker isolation | NanoClaw Container Sandbox (adopted) | Already planned |
| Config management | `@agent/sdk` config system | Already have cascading config |

### Worth Considering: Interactive Process Sessions

**What it does:** `start_process` + `interact_with_process` creates persistent REPL sessions — start `python3 -i`, send commands, read responses across multiple turns. The AI can maintain stateful sessions with databases, SSH connections, dev servers, etc.

**What we have:** Our `shellTool` runs fire-and-forget commands with `execFile`. No session persistence. If an agent needs to start a Python REPL, send 5 commands over multiple tool calls, and read output each time — we can't do that.

**Do we need it?** Maybe useful for power-user scenarios (data analysis, SSH, database REPLs), but it's a significant complexity add. For now, our agents can achieve most things with sequential shell commands. **Defer** — not critical for MVP.

### Worth Considering: `edit_block` Fuzzy Search/Replace

**What it does:** Search/replace with `<<<<<<< SEARCH` / `======= ` / `>>>>>>> REPLACE` markers. When exact match fails, it falls back to fuzzy matching with similarity scoring and character-level diffs (`{-removed-}{+added+}`). Includes logging for debugging failed edits.

**What we have:** Our `ast-grep` tool handles structural code search/replace (language-aware). For non-structural text editing, agents use `shellTool` with `sed` or write full files.

**Do we need it?** `ast-grep` is actually **better** for code editing — it understands syntax trees, not just text. The fuzzy search fallback is neat but papering over a fundamentally brittle approach (text matching in code). **Skip** — `ast-grep` is superior.

### Skip: Everything Else

- **Excel/PDF reading** — niche, can be done with shell commands + libraries when needed
- **URL fetching** — agents have other mechanisms
- **Onboarding/feedback/telemetry** — product features for Claude Desktop, irrelevant to SDK
- **Prompt injection system** — their approach of injecting prompts into tool results is a hack
- **MCP protocol layer** — we're building AI SDK tools, not MCP servers

### Verdict

**DesktopCommanderMCP doesn't give us anything we need right now.** Our existing tools (`shellTool`, `grepTool`, `globTool`, `ast-grep`) cover the same ground with better design: ripgrep search, file operations via shell, and language-aware code editing via ast-grep. The one genuine gap (interactive process sessions) is a "nice to have" that can be added later if agents actually need it.

---

## Vercel Agent Skills (skills.sh) — Adopt ⭐⭐

**Source:** [skills.sh](https://skills.sh) | `npx skills add <owner/repo>` | MIT

**What it is:** Vercel's open standard for packaging AI agent capabilities. The "npm for AI agents" — a CLI and registry that installs `SKILL.md`-based skills into your project. Skills work across Claude Code, Cursor, Windsurf, etc.

**How it works:**
```bash
# Install from registry
npx skills add vercel-labs/agent-skills

# Search for skills
npx skills find "deployment"

# Check for updates
npx skills check && npx skills update
```

The CLI clones the GitHub repo, downloads the skill into `.agents/skills/`, and symlinks to agent-specific dirs (`.claude/skills/`, `.cursor/skills/`).

**Skill format** (same YAML frontmatter + markdown pattern as NanoClaw):
```
.agents/skills/
├── react-best-practices/
│   └── SKILL.md          # React/Next.js performance patterns
├── web-design-guidelines/
│   └── SKILL.md          # UI/UX quality guidelines
└── vercel-deploy-claimable/
    ├── SKILL.md          # Deploy to Vercel from agent
    └── scripts/          # Helper scripts for deployment
```

**Why adopt:** This directly validates and standardizes the NanoClaw skills pattern we just adopted. Instead of rolling our own skill format + discovery, we align with Vercel's open standard:

| Our Original Plan | With skills.sh |
|-------------------|---------------|
| Custom `skills: [...]` config in `createAgent()` | Same, but skills installed via standard CLI |
| Our own SKILL.md format | Use the shared open standard format |
| Manual skill sharing | Registry + CLI for community distribution |
| Agent-specific loading | Cross-agent compatibility (Claude, Cursor, etc.) |

**Integration point:** Our SDK can read from `.agents/skills/` at runtime, auto-inject relevant skill descriptions into the system prompt, and load full SKILL.md content on demand.

---

## AI SDK `streamUI` / `createStreamableUI` — Defer ⚠️

**Source:** `@ai-sdk/rsc` | [docs](https://ai-sdk.dev/docs/ai-sdk-rsc/streaming-react-components)

**What it is:** RSC function that lets AI models respond with **React Server Components** instead of text. Tools return JSX that streams to the client in real-time. Model becomes a "dynamic router" — interprets user intent, calls the right tool, renders the appropriate component.

**How it works:**
```typescript
'use server';
import { streamUI } from '@ai-sdk/rsc';

export async function streamComponent() {
  const result = await streamUI({
    model: openai('gpt-4o'),
    prompt: 'Get the weather for San Francisco',
    text: ({ content }) => <div>{content}</div>,
    tools: {
      getWeather: {
        description: 'Get the weather for a location',
        inputSchema: z.object({ location: z.string() }),
        generate: async function* ({ location }) {
          yield <LoadingComponent />;
          const weather = await getWeather(location);
          return <WeatherComponent weather={weather} location={location} />;
        },
      },
    },
  });
  return result.value;
}
```

**Key points:**
- Tools define a `generate` function that returns JSX (not data)
- Generator functions (`function*`) allow streaming intermediate loading states via `yield`
- Requires Next.js Server Actions — tightly coupled to RSC architecture

**Why defer:**
1. **Explicitly experimental** — the AI SDK docs say "We recommend using AI SDK UI for production" and provide a migration guide away from RSC
2. **We already have two solutions** — `json-render` (generate UI specs from prompts) + AI Elements (pre-built chat components). These cover our generative UI needs without the RSC coupling
3. **Framework lock-in** — `streamUI` only works with Next.js Server Actions + RSC. Our SDK should stay framework-agnostic

**When to revisit:** If Vercel promotes `streamUI` from experimental to production-ready in AI SDK v7+, or if we build a Next.js-first agent framework.

---

## AI SDK DevTools — Adopt ⭐

**Source:** `@ai-sdk-tools/devtools` (community, by [Midday](https://midday.ai)) | [ai-sdk-tools.dev/devtools](https://ai-sdk-tools.dev/devtools)

**What it is:** React component for debugging AI applications during development. Drop-in `<AIDevtools />` component that tracks all AI tool calls, state changes, performance metrics, and errors in real-time. Like `react-query-devtools` but for AI.

**How it works:**
```typescript
import { AIDevtools } from '@ai-sdk-tools/devtools';

function App() {
  return (
    <div>
      <Chat />
      {process.env.NODE_ENV === 'development' && (
        <AIDevtools
          position="bottom-right"
          theme="dark"
          showMetrics={true}
          enableNetworkTab={true}
        />
      )}
    </div>
  );
}
```

**What it tracks:**
- All AI tool calls (inputs, outputs, timing)
- State changes and data flow
- Token usage and response times
- Errors with stack traces

**Why adopt:**
- **Zero production impact** — tree-shaken from production builds automatically
- **Complements our dashboard** — we already have SSE log streaming for server-side observability. DevTools adds client-side observability for the agent dashboard
- **Lightweight** — just a React component, no separate server or infrastructure

**Integration point:** Add `<AIDevtools />` to the Agent Dashboard in development mode. Our existing SSE logging handles server-side traces; DevTools handles the client-side AI SDK inspection layer.

**Note:** Vercel also has official `@ai-sdk/devtools` in the monorepo but it appears to be early-stage. The community `@ai-sdk-tools/devtools` from Midday is more mature and production-tested.

---

## ~~Vercel AI Gateway~~ — Skipped

**Why:** We already use **OpenRouter** for provider fallback, rate limiting, and model routing. AI Gateway would be redundant.

---

## ~~Apple Container SDK~~ — Deferred

**Why:** Only relevant when we actually build the container sandbox feature (from NanoClaw patterns). The Apple Container runtime works via CLI (`container` command) which is sufficient. Programmatic SDK/API research can happen when we're implementing the sandbox.

---

## Langfuse — Adopt ⭐⭐

**Source:** [langfuse.com](https://langfuse.com) | `npm i langfuse` | MIT (self-hosted) or free cloud tier

**What it is:** Open-source LLM observability platform with native AI SDK integration. Tracks every LLM call — inputs, outputs, token usage, latency, cost — in a purpose-built dashboard. First-party integration via `@langfuse/ai-sdk`.

**Free options:**

| Option | Cost | Limits |
|--------|------|--------|
| **Langfuse Cloud** | $0 | 50k observations/month (plenty for local dev + early production) |
| **Self-hosted** | $0 | Unlimited — Docker Compose, runs on any VPS |

**AI SDK integration (5 lines):**
```typescript
import { Langfuse } from 'langfuse';

const langfuse = new Langfuse();

const result = await generateText({
  model: openai('gpt-4o'),
  prompt: 'Analyze this codebase',
  experimental_telemetry: {
    isEnabled: true,
    functionId: 'codebase-analysis',
  },
});
```

The AI SDK's built-in `experimental_telemetry` emits OpenTelemetry spans. Langfuse captures these automatically via its OpenTelemetry collector — zero wrapper code needed.

**What you get (that our custom logging doesn't give us):**
- **Cost tracking** — per-call and cumulative cost across models/providers
- **Latency histograms** — P50/P95/P99 response times
- **Token usage breakdown** — input vs output vs cached tokens per call
- **Trace visualization** — multi-step agent runs as waterfall traces
- **Prompt versioning** — track which prompts produced which results
- **Evaluations** — score agent outputs, build eval datasets

**What this replaces in our SDK:**

| Current Custom Solution | Langfuse Replacement |
|------------------------|---------------------|
| `@agent/logger` structured logs | Still useful for code debugging, but not needed for LLM observability |
| SSE log streaming to dashboard | Replace with Langfuse dashboard — purpose-built for LLM traces |
| Custom token counting | Built-in, automatic |
| No cost tracking | Automatic cost computation per model/provider |

**Why adopt over alternatives:**

| Tool | Why Not |
|------|---------|
| Helicone | Proxy-based — adds latency, requires routing all calls through their proxy |
| LangSmith | LangChain-centric, not great AI SDK integration |
| Custom OpenTelemetry | Too much infrastructure work for what Langfuse gives you out of the box |
| Our SSE logging | Maintenance burden, limited features, no cost/eval tracking |

**Integration point:** Add Langfuse to the Agent Dashboard as the observability backend. Keep `@agent/logger` for code-level debugging. Deprecate the custom SSE log streaming for LLM observability in favor of Langfuse traces.

**Do we need it for local dev?** The free cloud tier is fine for local dev (50k observations/month). You don't need to self-host until you're at scale. For pure local debugging, AI SDK DevTools (already adopted) handles the quick inspection use case — Langfuse handles the "I need to understand what my agent did across 50 runs" use case.

---

## Research Backlog

All current items researched. New items as they arise:

- [x] ~~Langfuse for LLM observability~~ — researched, **adopted** (replaces custom SSE logging)
- [x] ~~AI SDK v6 `streamUI` / `createStreamableUI`~~ — researched, **deferred** (experimental, we have json-render + AI Elements)
- [x] ~~AI SDK DevTools~~ — researched, **adopted** (client-side debugging for dashboard)
- [x] ~~Vercel AI Gateway~~ — **skipped** (OpenRouter covers it)
- [x] ~~Agent Skills package (skills.sh)~~ — researched, **adopted** (validates NanoClaw skills pattern)
- [x] ~~Apple Container SDK~~ — **deferred** (research when building sandbox)
- [x] ~~Workflow DevKit (useworkflow.dev)~~ — researched, see above
- [x] ~~Agent Browser (vercel-labs/agent-browser)~~ — researched, see above
- [x] ~~JSON Render (vercel-labs/json-render)~~ — researched, see above
- [x] ~~Kernel Browser Automation~~ — researched, **skipped** (agent-browser covers it)
- [x] ~~DesktopCommanderMCP~~ — researched, **skipped** (our tools cover it)



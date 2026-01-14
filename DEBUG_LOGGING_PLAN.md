# SDK Debug Logging Architecture

## Research Summary

### Industry Patterns Discovered

| Pattern | Used By | Key Features |
|---------|---------|--------------|
| **Namespace-based debug** | Express, Axios, many npm packages | `DEBUG=@agent/sdk:*` env var, hierarchical namespaces |
| **Structured JSON logging** | Pino, Winston | Machine-parseable, log levels, context objects |
| **AI SDK DevTools** | Vercel AI SDK | Middleware pattern, captures to `.devtools/generations.json` |
| **Log levels** | All production loggers | error, warn, info, debug, trace |

---

## Proposed Design: Hybrid Approach

Combine the **simplicity of `debug`** with **structured JSON output** and **zero dependencies**.

### Key Features

1. **Namespace-based filtering** via `DEBUG` env var (like Express/debug npm)
2. **Log levels** (error, warn, info, debug, trace)
3. **Structured JSON output** for machine parsing
4. **Pretty console output** for development
5. **Zero dependencies** - built from scratch for portability
6. **Child loggers** with inherited context
7. **Automatic tree-shaking** in production builds

---

## API Design

### Basic Usage

```typescript
import { createLogger } from '@agent/sdk/debug';

// Create a logger with namespace
const log = createLogger('@agent/sdk:agent');

log.info('Agent created', { agentId: 'abc-123', role: 'coder' });
log.debug('Building tools', { preset: 'standard' });
log.error('Tool execution failed', { toolName: 'shell', error: err });
```

### Environment Variable Control

```bash
# Enable all SDK debug logs
DEBUG=@agent/sdk:* node app.js

# Enable specific namespaces
DEBUG=@agent/sdk:agent,@agent/sdk:tools node app.js

# Enable with log level filter
DEBUG=@agent/sdk:* DEBUG_LEVEL=info node app.js

# Disable specific namespaces
DEBUG=@agent/sdk:*,-@agent/sdk:memory node app.js

# Enable JSON output (for piping to jq, etc.)
DEBUG_FORMAT=json node app.js
```

### Child Loggers with Context

```typescript
const agentLog = createLogger('@agent/sdk:agent');

// Create child logger with additional context
const runLog = agentLog.child({ 
  runId: 'run-123',
  userId: 'user-456' 
});

runLog.info('Starting agent run');
// Output includes: { runId: 'run-123', userId: 'user-456', ... }
```

### Tool-Specific Logging

```typescript
// Each tool module creates its own logger
// src/tools/filesystem/tools.ts
const log = createLogger('@agent/sdk:tools:filesystem');

log.debug('Reading file', { path: '/foo/bar.ts' });
log.trace('File content loaded', { bytes: 1234 });
```

---

## Log Levels

| Level | When to Use | Env Threshold |
|-------|-------------|---------------|
| `error` | Failures that need attention | Always shown |
| `warn` | Recoverable issues | DEBUG_LEVEL=warn |
| `info` | Key operations | DEBUG_LEVEL=info |
| `debug` | Detailed debugging | DEBUG_LEVEL=debug |
| `trace` | Very verbose | DEBUG_LEVEL=trace |

---

## Output Formats

### Pretty (default for TTY)

```
[@agent/sdk:agent] INFO  Agent created agentId=abc-123 role=coder
[@agent/sdk:tools:shell] DEBUG Executing command cmd="npm test"
[@agent/sdk:tools:shell] TRACE Output chunk bytes=1234
```

### JSON (for log aggregation)

```json
{"timestamp":"2026-01-14T12:56:54Z","namespace":"@agent/sdk:agent","level":"info","message":"Agent created","agentId":"abc-123","role":"coder"}
{"timestamp":"2026-01-14T12:56:55Z","namespace":"@agent/sdk:tools:shell","level":"debug","message":"Executing command","cmd":"npm test"}
```

---

## Implementation Plan

### Phase 1: Core Logger

| File | Description |
|------|-------------|
| `src/debug/logger.ts` | Core `createLogger()` factory |
| `src/debug/levels.ts` | Log level definitions and filtering |
| `src/debug/formatter.ts` | Pretty and JSON formatters |
| `src/debug/namespace.ts` | Namespace matching (wildcards, exclusions) |
| `src/debug/index.ts` | Exports |

### Phase 2: Integration

| File | Change |
|------|--------|
| `src/agent.ts` | Add logging throughout agent lifecycle |
| `src/tools/filesystem/tools.ts` | Add logging to file operations |
| `src/tools/shell/tools.ts` | Add logging to command execution |
| `src/memory/tools.ts` | Add logging to memory operations |
| `src/workflow/*.ts` | Add logging to workflow operations |

### Phase 3: Advanced Features

| Feature | Description |
|---------|-------------|
| `DEBUG_FILE` | Write logs to file in addition to console |
| `DEBUG_REDACT` | Automatically redact sensitive data |
| `DEBUG_TIMING` | Add performance timing to logs |
| Child logger inheritance | Pass context down through tool calls |

---

## Namespace Convention

```
@agent/sdk:agent           # Agent lifecycle
@agent/sdk:agent:spawn     # Sub-agent spawning
@agent/sdk:tools           # All tools
@agent/sdk:tools:filesystem# Filesystem tool
@agent/sdk:tools:shell     # Shell tool
@agent/sdk:tools:memory    # Memory operations
@agent/sdk:tools:plan      # Planning tool
@agent/sdk:tools:reasoning # Reasoning tool
@agent/sdk:workflow        # Workflow/durability
@agent/sdk:streaming       # Transient streaming
@agent/sdk:config          # Configuration loading
@agent/sdk:models          # Model resolution
```

---

## Files to Create

### Core Implementation

```
src/debug/
├── index.ts            # Exports
├── logger.ts           # createLogger factory
├── levels.ts           # Log level enum and filtering
├── formatter.ts        # Pretty and JSON output
├── namespace.ts        # Namespace matching logic
└── types.ts            # TypeScript types
```

### Types

```typescript
// src/debug/types.ts
export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'trace';

export interface Logger {
  error(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  debug(message: string, context?: Record<string, unknown>): void;
  trace(message: string, context?: Record<string, unknown>): void;
  child(context: Record<string, unknown>): Logger;
  isEnabled(): boolean;
}

export interface LoggerOptions {
  namespace: string;
  level?: LogLevel;
  format?: 'pretty' | 'json';
  output?: (line: string) => void;
}
```

---

## Production Considerations

### Tree-Shaking

```typescript
// All debug calls become no-ops when DEBUG is not set
const log = createLogger('@agent/sdk:agent');

// In production (DEBUG not set):
log.debug('This is a no-op'); // Function returns immediately
```

### Performance

- Lazy evaluation of log arguments
- Early bail-out when namespace not enabled
- Minimal object allocations when logging disabled

### Security

- Never log sensitive data (API keys, tokens)
- Built-in redaction for common patterns
- `DEBUG_REDACT` patterns configurable

---

## Usage Examples

### Debugging Agent Issues

```bash
# See all agent activity
DEBUG=@agent/sdk:agent* node my-agent.js

# See tool execution details
DEBUG=@agent/sdk:tools* DEBUG_LEVEL=trace node my-agent.js

# See everything
DEBUG=@agent/sdk:* DEBUG_FORMAT=json node my-agent.js 2>&1 | jq
```

### Debugging Specific Module

```bash
# Only see memory operations
DEBUG=@agent/sdk:memory node my-agent.js

# See shell commands with full output
DEBUG=@agent/sdk:tools:shell DEBUG_LEVEL=trace node my-agent.js
```

---

## Verification Plan

### Unit Tests

- [ ] `src/debug/__tests__/logger.test.ts` - Logger creation and methods
- [ ] `src/debug/__tests__/namespace.test.ts` - Namespace matching
- [ ] `src/debug/__tests__/formatter.test.ts` - Output formatting
- [ ] `src/debug/__tests__/levels.test.ts` - Level filtering

### Integration Tests

- [ ] DEBUG env var enables logging
- [ ] Namespace wildcards work correctly
- [ ] JSON output is valid JSON
- [ ] Child loggers inherit context
- [ ] No output when DEBUG not set

### Manual Tests

1. Run `DEBUG=@agent/sdk:* pnpm test` and verify debug output appears
2. Run without DEBUG and verify no debug output
3. Run with `DEBUG_FORMAT=json` and pipe to `jq` to verify valid JSON

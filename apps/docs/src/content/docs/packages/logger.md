---
title: Logger
description: Zero-dependency structured logging with namespace filtering
---

# Logger (`@agntk/logger`)

Zero-dependency structured logging with namespace filtering.

## Basic Usage

```typescript
import { createLogger } from '@agntk/logger';

const log = createLogger('@myapp:feature');

log.info('Request processed', { userId: '123', durationMs: 45 });
log.warn('Rate limit approaching');
log.error('Failed to connect', { error: err.message });
log.debug('Cache hit', { key: 'user:123' });
```

## Timing Helper

```typescript
const done = log.time('db-query');
await queryDatabase();
done(); // Logs with duration
```

## Namespace Filtering

Enable via environment variable:

```bash
DEBUG=@agntk/core:* node app.js
DEBUG=@agntk/*,-@agntk/core:verbose node app.js
```

Or programmatically:

```typescript
import { enable, disable, resetConfig } from '@agntk/logger';

enable('@myapp:*');
disable('@myapp:verbose');
resetConfig();  // Clear all patterns
```

## Transports

### Console (Default)

```typescript
import { createConsoleTransport, addTransport } from '@agntk/logger';

addTransport(createConsoleTransport({ colorize: true }));
```

### File Output

```typescript
import { createFileTransport, addTransport } from '@agntk/logger';

addTransport(createFileTransport({ path: './logs/agent.log' }));
```

### SSE for Real-time UI

```typescript
import { createSSETransport, addTransport } from '@agntk/logger';

const sse = createSSETransport();
addTransport(sse);
```

## Formatters

```typescript
import { formatPretty, formatJSON, formatSSE } from '@agntk/logger';

const entry = {
  level: 'info',
  namespace: '@app',
  message: 'hello',
  timestamp: Date.now(),
  data: {}
};

formatPretty(entry);  // "INF [@app] hello"
formatJSON(entry);    // {"level":"info","namespace":"@app",...}
formatSSE(entry);     // "data: {...}\n\n"
```

## Next Steps

- [SDK Core](/packages/sdk) — Learn about agent configuration
- [SDK Server](/packages/sdk-server) — Set up an HTTP server


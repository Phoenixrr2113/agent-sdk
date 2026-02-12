---
title: "Logger"
description: "Structured logging — namespace filtering, file/SSE transports, formatters"
---

Zero-dependency structured logging with namespace filtering.

```typescript
import { createLogger } from '@agntk/logger';

const log = createLogger('@myapp:feature');
log.info('Request processed', { userId: '123', durationMs: 45 });
log.warn('Rate limit approaching');
log.error('Failed to connect', { error: err.message });
```

Namespace filtering via `DEBUG` env var (e.g. `DEBUG=@agntk/core:*`). Transports: console, file, SSE. Formatters: pretty, JSON, SSE.

---

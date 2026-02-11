---
title: Brain
description: Knowledge graph backed by FalkorDB with code parsing and NLP entity extraction
---

# Brain (`@agntk/brain`)

Knowledge graph backed by FalkorDB with code parsing and NLP entity extraction.

## Basic Setup

```typescript
import { createBrain } from '@agntk/brain';

// Connect to FalkorDB
const brain = await createBrain({
  graph: {
    host: 'localhost',
    port: 6379,
    graphName: 'my_graph'
  },
  extraction: { enabled: false },
});
```

## Using with an Agent

```typescript
import { createAgent } from '@agntk/core';

const agent = createAgent({
  brain,
  toolPreset: 'none',  // Brain provides its own tools
});

// Agent now has: queryKnowledge, remember, recall, extractEntities
```

## Direct Usage

```typescript
// Remember a fact
await brain.remember('TypeScript uses structural typing');

// Recall related facts
const results = await brain.recall('typing system');

// Clean up
await brain.close();
```

## Running FalkorDB

FalkorDB is required for the Brain package. Run it locally with Docker:

```bash
docker run -p 6379:6379 falkordb/falkordb
```

Or use a remote FalkorDB instance by configuring the host and port.

## Features

- **Code Parsing** — Extract entities and relationships from source code
- **NLP Entity Extraction** — Automatically identify and link entities in text
- **Knowledge Queries** — Semantic search over your knowledge graph
- **Tool Integration** — Auto-inject knowledge tools into agents

## Next Steps

- [SDK Core](/packages/sdk) — Learn about agent configuration
- [SDK Server](/packages/sdk-server) — Serve agents over HTTP


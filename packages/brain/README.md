# @agntk/brain

Knowledge graph and memory system for AI agents. Backed by FalkorDB with code parsing and NLP entity extraction.

## Install

```bash
npm install @agntk/brain
```

## Quick Start

```typescript
import { createBrain } from '@agntk/brain';
import { createAgent } from '@agntk/core';

const brain = await createBrain({
  graph: { host: 'localhost', port: 6379, graphName: 'my_graph' },
});

// Use with an agent (auto-injects knowledge tools):
const agent = createAgent({ brain });

// Or use directly:
await brain.remember('TypeScript uses structural typing');
const results = await brain.recall('typing system');
await brain.close();
```

## Requirements

FalkorDB running locally:

```bash
docker run -p 6379:6379 falkordb/falkordb
```

## Features

- **Knowledge Graph** — FalkorDB-backed graph storage
- **Code Parsing** — Tree-sitter integration for TypeScript, Python, C#
- **NLP Extraction** — Entity and relationship extraction from text
- **Agent Integration** — Auto-injects `queryKnowledge`, `remember`, `recall`, `extractEntities` tools

## Documentation

See the [main repository](https://github.com/agntk/agntk) for full documentation.

## License

MIT

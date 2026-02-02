# Agent Dashboard

Real-time monitoring and control dashboard for `@agent/sdk` agents.

## Features

- **Log Viewer** - Real-time log streaming via SSE with level filtering and namespace highlighting
- **Chat Panel** - Interactive chat interface for testing agent prompts
- **Config Editor** - Live role and tool configuration management
- **Status Panel** - Agent health and session status monitoring

## Getting Started

### Prerequisites

Ensure the agent server is running:

```bash
# From monorepo root
pnpm --filter @agent/sdk-server dev
```

### Run the Dashboard

```bash
# From monorepo root
pnpm --filter @agent/dashboard dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Architecture

```
src/
├── app/
│   ├── layout.tsx     # Root layout with font configuration
│   ├── page.tsx       # Main dashboard page
│   └── globals.css    # Global styles
├── components/
│   ├── ChatPanel.tsx      # Interactive chat with agent
│   ├── ConfigEditor.tsx   # Role/tool configuration UI
│   ├── LogViewer.tsx      # SSE log stream viewer
│   └── StatusPanel.tsx    # Agent health display
└── lib/
    └── utils/             # Shared utilities
```

## Components

### LogViewer

Connects to the SSE endpoint at `http://localhost:7777/logs/stream` for real-time log viewing.

Features:
- Level filtering (error, warn, info, debug, trace)
- Namespace coloring for visual grouping
- Auto-scroll with manual override
- JSON data expansion

### ChatPanel

Sends prompts to the agent server at `http://localhost:7777/generate`.

Features:
- Multi-line input
- Streaming response support
- Session history

### ConfigEditor

Displays and allows editing of agent configuration.

Features:
- JSON/YAML syntax highlighting
- Live validation
- Save to server

### StatusPanel

Displays agent health and session information.

Features:
- Health check polling
- Active session count
- Memory usage

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_AGENT_URL` | `http://localhost:7777` | Agent server URL |
| `NEXT_PUBLIC_LOG_STREAM_URL` | `http://localhost:7777/logs/stream` | SSE log endpoint |

## Development

This is a [Next.js](https://nextjs.org) application using:

- **Next.js 15** - App Router
- **Tailwind CSS 4** - Styling
- **TypeScript** - Type safety
- **Geist Font** - Typography

### Key Scripts

```bash
pnpm dev      # Start development server
pnpm build    # Build for production
pnpm start    # Run production build
pnpm lint     # Run ESLint
```

## Integration with @agent/sdk

The dashboard consumes logs via the `@agent/logger` SSE transport:

```typescript
// In your agent setup
import { addTransport, createSSETransport } from '@agent/logger';

// Enable SSE streaming for dashboard
addTransport(createSSETransport({ port: 7777, path: '/logs/stream' }));
```

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [@agent/logger Documentation](../../packages/logger/README.md)
- [@agent/sdk Documentation](../../packages/sdk/README.md)

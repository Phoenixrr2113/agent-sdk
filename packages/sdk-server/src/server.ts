/**
 * @agent/sdk-server - Server Factory
 * Creates and manages the agent HTTP server
 */

import { serve } from '@hono/node-server';
import { createLogger } from '@agent/logger';
import { createAgentRoutes } from './routes';
import type { AgentServerOptions } from './types';

const log = createLogger('@agent/sdk-server');

export interface AgentServer {
  /** Hono routes instance */
  routes: ReturnType<typeof createAgentRoutes>;
  
  /** Start the HTTP server */
  start: () => void;
  
  /** Get the server port */
  port: number;
}

/**
 * Create an agent server with HTTP endpoints
 * 
 * @example
 * ```typescript
 * import { createAgentServer } from '@agent/sdk-server';
 * import { createAgent } from '@agent/sdk';
 * 
 * const agent = createAgent({ role: 'coder' });
 * const server = createAgentServer({ agent, port: 3001 });
 * server.start();
 * ```
 * 
 * @param options - Server configuration
 * @returns Server instance with routes and start method
 */
export function createAgentServer(options: AgentServerOptions = {}): AgentServer {
  const port = options.port ?? 3000;
  
  log.debug('Creating agent server', { port, hasAgent: !!options.agent });

  // Create agent if options provided but no agent instance
  let agent = options.agent;
  if (!agent && options.agentOptions) {
    log.warn('agentOptions provided but no agent instance. Agent will need to be created separately.');
  }

  const routes = createAgentRoutes({
    ...options,
    agent,
  });

  const start = () => {
    serve({ 
      fetch: routes.fetch, 
      port,
    });
    log.info('Agent server started', { port, url: `http://localhost:${port}` });
  };

  return { 
    routes, 
    start,
    port,
  };
}

/**
 * Quick start helper - creates agent and server in one call
 * 
 * @example
 * ```typescript
 * import { quickStart } from '@agent/sdk-server';
 * 
 * quickStart({ port: 3001, role: 'researcher' });
 * ```
 */
export async function quickStart(options: {
  port?: number;
  role?: 'generic' | 'coder' | 'researcher' | 'analyst';
  workspaceRoot?: string;
} = {}) {
  log.info('quickStart called', { options });
  
  const server = createAgentServer({ port: options.port });
  server.start();
  return server;
}

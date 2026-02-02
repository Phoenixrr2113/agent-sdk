/**
 * Agent Server - Run the agent with HTTP endpoints
 */
import 'dotenv/config';

// Enable debug logging for all @agent/* namespaces at trace level (maximum verbosity)
process.env.DEBUG = process.env.DEBUG || '@agent/*';
process.env.DEBUG_LEVEL = process.env.DEBUG_LEVEL || 'trace';

import { createAgent } from './packages/sdk/dist/index.js';
import { createAgentServer } from './packages/sdk-server/dist/index.js';

// Create agent with debugger role
const agent = createAgent({
  role: 'debugger',
  workspaceRoot: process.cwd(),
  maxSteps: 10,
});

// Create and start server
const server = createAgentServer({
  agent,
  port: 3000,
  configPath: './agent-sdk.config.yaml',
});

console.log('🤖 Agent Server starting...');
console.log(`   Role: ${agent.role ?? 'debugger'}`);
console.log(`   Port: ${server.port}`);

server.start();

console.log(`\n✅ Server running at http://localhost:${server.port}`);
console.log('   Endpoints:');
console.log('   - GET  /health');
console.log('   - GET  /status');
console.log('   - GET  /config');
console.log('   - PUT  /config');
console.log('   - GET  /logs (SSE)');
console.log('   - POST /stream');
console.log('   - POST /generate');

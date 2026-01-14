/**
 * Test template substitution
 */
import 'dotenv/config';
import { createAgent } from './packages/sdk/dist/index.js';

// Use the custom "debugger" role from config
const agent = createAgent({
  role: 'debugger',
  workspaceRoot: process.cwd(),
  maxSteps: 3,
});

console.log('Agent:', agent.agentId);
console.log('Role: debugger (custom from config)');
console.log('\n=== SYSTEM PROMPT (checking template substitution) ===');
console.log(agent.getSystemPrompt().slice(0, 500));
console.log('\n=== Expected: "agent-sdk" and "TypeScript" should appear ===');

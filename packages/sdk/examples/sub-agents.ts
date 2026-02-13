/**
 * @fileoverview Sub-agents example.
 * Demonstrates spawning specialized sub-agents for complex tasks.
 *
 * Sub-agent spawning is built into createAgent — the agent has access
 * to the spawn_agent tool which creates child agents with specific roles.
 */

import { createAgent } from '@agntk/core';

async function main() {
  // Create coordinator agent — spawn_agent tool is included by default
  const coordinator = createAgent({
    name: 'coordinator',
    instructions: `You are a project coordinator.
For complex coding tasks, delegate to a coder sub-agent.
For research tasks, delegate to a researcher sub-agent.
Focus on planning and synthesis.`,
    workspaceRoot: process.cwd(),
  });

  // The coordinator can spawn sub-agents via the spawn_agent tool
  const result = await coordinator.stream({
    prompt: `Analyze this codebase:
1. Have a coder review the main source files
2. Have a researcher find relevant documentation patterns
3. Synthesize their findings into recommendations`,
  });

  // Stream the result
  for await (const chunk of result.fullStream) {
    switch (chunk.type) {
      case 'text-delta':
        process.stdout.write(chunk.text as string);
        break;
      case 'tool-call':
        if (chunk.toolName === 'spawn_agent') {
          console.log(`\n[Spawning sub-agent: ${(chunk.args as Record<string, string>).role}]`);
        }
        break;
    }
  }

  const text = await result.text;
  console.log('\n\nCoordinator result length:', text.length);
}

main().catch(console.error);

/**
 * @fileoverview Basic agent usage example.
 * Demonstrates core API for creating and using an agent.
 */

import { createAgent } from '@agntk/core';

async function main() {
  // Create agent with the unified API
  const agent = createAgent({
    name: 'basic-example',
    instructions: 'You are a helpful coding assistant.',
    workspaceRoot: process.cwd(),
    maxSteps: 20,
  });

  // Streaming (primary API)
  console.log('=== Streaming ===');
  const result = await agent.stream({
    prompt: 'List the files in the current directory',
  });

  for await (const chunk of result.fullStream) {
    switch (chunk.type) {
      case 'text-delta':
        process.stdout.write(chunk.text as string);
        break;
      case 'tool-call':
        console.log(`\n[Tool: ${chunk.toolName}]`);
        break;
    }
  }

  // Get final text and usage
  const text = await result.text;
  const usage = await result.usage;
  console.log('\n\nFinal text length:', text.length);
  console.log('Usage:', usage);
}

main().catch(console.error);

/**
 * @fileoverview Memory integration example.
 * Demonstrates semantic memory for context persistence.
 *
 * Memory is always enabled in createAgent — the agent automatically
 * has access to remember, recall, and forget tools.
 */

import { createAgent } from '@agntk/core';

async function main() {
  // Create agent — memory tools are included by default
  const agent = createAgent({
    name: 'memory-example',
    instructions: 'You are a researcher. Store important findings in memory for future reference.',
    workspaceRoot: process.cwd(),
  });

  // First conversation - store information
  console.log('=== First Conversation ===');
  const result1 = await agent.stream({
    prompt: `Research the authentication patterns in this codebase.
Store important findings in memory for future reference.`,
  });

  // Drain stream to completion
  for await (const chunk of result1.fullStream) {
    if (chunk.type === 'text-delta') {
      process.stdout.write(chunk.text as string);
    }
  }
  console.log('\n');

  // Later conversation - recall from memory
  console.log('=== Later Conversation ===');
  const result2 = await agent.stream({
    prompt: `What authentication patterns were found earlier?
Use memory to recall previous research.`,
  });

  for await (const chunk of result2.fullStream) {
    if (chunk.type === 'text-delta') {
      process.stdout.write(chunk.text as string);
    }
  }
  console.log('\n');

  // Memory tools available:
  // - remember: Store information for later recall
  // - recall: Retrieve previously stored memories
  // - forget: Remove memories matching a query
}

main().catch(console.error);

/**
 * Self-Aware Agent Demo
 * 
 * This demo shows an AI agent using its brain to:
 * 1. Query its own codebase knowledge graph
 * 2. Remember facts about itself
 * 3. Recall those facts
 * 4. Execute shell commands (like building itself)
 */

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { createBrain, parseProject, createBrainTools } from '../src';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const brainPath = path.resolve(__dirname, '..');

async function runWithTools(prompt: string, tools: ReturnType<typeof createBrainTools>) {
  const result = await generateText({
    model: anthropic('claude-sonnet-4-20250514'),
    tools,
    maxSteps: 10,
    prompt,
  });
  return result.text;
}

async function main() {
  console.log('='.repeat(60));
  console.log('Self-Aware Agent Demo');
  console.log('='.repeat(60));
  console.log();
  console.log(`Brain path: ${brainPath}`);
  console.log();

  // 1. Index the brain package into FalkorDB
  console.log('Step 1: Indexing brain package into knowledge graph...');
  try {
    const result = await parseProject(brainPath, [], { deepAnalysis: true });
    console.log(`  ✓ Indexed ${result.stats.files} files, ${result.stats.entities} entities`);
  } catch (error) {
    console.error(`  ✗ Failed to index: ${error instanceof Error ? error.message : String(error)}`);
    console.log('  Make sure FalkorDB is running on localhost:6379');
    console.log('  Run: docker run -p 6379:6379 falkordb/falkordb');
    return;
  }
  console.log();

  // 2. Create a brain instance with all features
  console.log('Step 2: Creating brain instance...');
  const brain = await createBrain({
    graph: { host: 'localhost', port: 6379 },
    extraction: { enabled: true },
  });
  console.log('  ✓ Brain connected');
  console.log();

  // 3. Create brain tools
  console.log('Step 3: Creating brain tools...');
  const tools = createBrainTools(brain);
  const toolNames = Object.keys(tools);
  console.log(`  ✓ ${toolNames.length} tools available:`);
  for (const name of toolNames) {
    console.log(`    - ${name}`);
  }
  console.log();

  // 4. Demo: Query about itself
  console.log('Step 4: Self-query - "How does remember() work?"');
  console.log('-'.repeat(60));
  try {
    const queryResult = await runWithTools(
      `Using the queryKnowledge tool, search for the "remember" function in the brain package. 
Then briefly explain what it does based on the search results.`,
      tools
    );
    console.log(queryResult || '(No text response - check tool results)');
  } catch (error) {
    console.log(`  Error: ${error instanceof Error ? error.message : String(error)}`);
  }
  console.log();

  // 5. Demo: Remember something about itself
  console.log('Step 5: Remembering a fact...');
  console.log('-'.repeat(60));
  try {
    const rememberResult = await runWithTools(
      `Using the remember tool, store this fact: 
"The brain package uses FalkorDB for persistent episodic memory."
Include context with project: "agent-sdk" and task: "demo".`,
      tools
    );
    console.log(rememberResult || '(Fact stored)');
  } catch (error) {
    console.log(`  Error: ${error instanceof Error ? error.message : String(error)}`);
  }
  console.log();

  // 6. Demo: Recall the fact
  console.log('Step 6: Recalling the fact...');
  console.log('-'.repeat(60));
  try {
    const recallResult = await runWithTools(
      `Using the recall tool, retrieve information about "episodic memory" or "FalkorDB".
Summarize what you find.`,
      tools
    );
    console.log(recallResult || '(No memories found)');
  } catch (error) {
    console.log(`  Error: ${error instanceof Error ? error.message : String(error)}`);
  }
  console.log();

  // 7. Demo: Execute shell command (build the brain)
  console.log('Step 7: Building the brain package...');
  console.log('-'.repeat(60));
  try {
    const buildResult = await runWithTools(
      `Using the execute tool, run "pnpm build" in the directory "${brainPath}" to verify the brain package compiles.
Report whether the build succeeded or failed.`,
      tools
    );
    console.log(buildResult || '(Build completed)');
  } catch (error) {
    console.log(`  Error: ${error instanceof Error ? error.message : String(error)}`);
  }
  console.log();

  // 8. Demo: Self-analysis
  console.log('Step 8: Self-analysis');
  console.log('-'.repeat(60));
  try {
    const analysisResult = await runWithTools(
      `Analyze the brain package architecture:
1. Use queryKnowledge to find key modules (search for "graph", "nlp", "parser")
2. Summarize the main components you found
3. Suggest one improvement for the brain system`,
      tools
    );
    console.log(analysisResult || '(Analysis complete)');
  } catch (error) {
    console.log(`  Error: ${error instanceof Error ? error.message : String(error)}`);
  }
  console.log();

  // Cleanup
  await brain.close();
  console.log('✓ Brain connection closed');
  console.log();
  console.log('Demo complete!');
  console.log('='.repeat(60));
}

main().catch((error) => {
  console.error('Demo failed:', error);
  process.exit(1);
});

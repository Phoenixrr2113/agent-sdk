/**
 * Demo CLI — Interactive REPL exercising @agent/sdk directly
 *
 * Usage: pnpm demo (from monorepo root)
 */

import * as path from 'node:path';
import * as readline from 'node:readline';
import { config } from 'dotenv';

// Load .env from monorepo root
const root = path.resolve(import.meta.dirname, '..', '..', '..');
config({ path: path.join(root, '.env') });

import { createAgent } from '@agent/sdk';

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function hr(label: string) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${label}`);
  console.log(`${'═'.repeat(60)}\n`);
}

function printResult(result: { text: string; steps: { toolCalls: unknown[] }[] }) {
  console.log('\n📝 Response:\n');
  console.log(result.text);

  const toolCalls = result.steps.flatMap((s) =>
    (s.toolCalls ?? []).map((tc: any) => tc.toolName ?? tc.name ?? 'unknown')
  );
  if (toolCalls.length > 0) {
    console.log(`\n🔧 Tools used: ${toolCalls.join(', ')}`);
  }
  console.log(`📊 Steps: ${result.steps.length}`);
}

// ────────────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────────────

async function main() {
  hr('Agent SDK — CLI Demo');

  console.log('Creating agent (role=coder, toolPreset=standard)...');

  let agent: ReturnType<typeof createAgent>;
  try {
    agent = createAgent({
      role: 'coder',
      toolPreset: 'standard',
      workspaceRoot: root,
      maxSteps: 15,
    });
    console.log('✅ Agent created successfully\n');
  } catch (err) {
    console.error('❌ Failed to create agent:', err);
    process.exit(1);
  }

  // ── Initial test prompt ──────────────────────────────────────────────────
  hr('Test 1: generate() — "List the files in the current directory"');

  try {
    const result = await agent.generate({
      prompt: 'List the files in the current directory. Be concise.',
    });
    printResult(result as any);
  } catch (err) {
    console.error('❌ generate() failed:', err);
  }

  // ── Interactive REPL ─────────────────────────────────────────────────────
  hr('Interactive REPL (type "exit" to quit)');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '🤖 > ',
  });

  rl.prompt();

  rl.on('line', async (line: string) => {
    const input = line.trim();
    if (!input) {
      rl.prompt();
      return;
    }
    if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit') {
      console.log('\nGoodbye! 👋');
      rl.close();
      process.exit(0);
    }

    try {
      const result = await agent.generate({ prompt: input });
      printResult(result as any);
    } catch (err) {
      console.error('❌ Error:', err);
    }

    rl.prompt();
  });
}

main().catch((err) => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});

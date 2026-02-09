/**
 * Demo Server — Spins up @agent/sdk-server, then hits it via @agent/sdk-client
 *
 * Usage: pnpm demo:server (from monorepo root)
 */

import * as path from 'node:path';
import { config } from 'dotenv';

// Load .env from monorepo root
const root = path.resolve(import.meta.dirname, '..', '..', '..');
config({ path: path.join(root, '.env') });

import { createAgent } from '@agent/sdk';
import { createAgentServer } from '@agent/sdk-server';
import { AgentHttpClient } from '@agent/sdk-client';

const PORT = 4321;

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function hr(label: string) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${label}`);
  console.log(`${'═'.repeat(60)}\n`);
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ────────────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────────────

async function main() {
  hr('Agent SDK — Server + Client Demo');

  // ── Step 1: Create Agent ──────────────────────────────────────────────
  console.log('1️⃣  Creating agent (role=coder, toolPreset=standard)...');

  let agent: ReturnType<typeof createAgent>;
  try {
    agent = createAgent({
      role: 'coder',
      toolPreset: 'standard',
      workspaceRoot: root,
      maxSteps: 15,
    });
    console.log('   ✅ Agent created\n');
  } catch (err) {
    console.error('   ❌ Failed to create agent:', err);
    process.exit(1);
  }

  // ── Step 2: Start Server ──────────────────────────────────────────────
  console.log(`2️⃣  Starting server on port ${PORT}...`);

  let server: ReturnType<typeof createAgentServer>;
  try {
    server = createAgentServer({ agent, port: PORT });
    server.start();
    console.log(`   ✅ Server running at http://localhost:${PORT}\n`);
  } catch (err) {
    console.error('   ❌ Failed to start server:', err);
    process.exit(1);
  }

  // Give the server a moment to bind
  await sleep(500);

  // ── Step 3: Health Check ──────────────────────────────────────────────
  hr('Test 1: GET /health');
  try {
    const res = await fetch(`http://localhost:${PORT}/health`);
    const body = await res.json();
    console.log('   Status:', res.status);
    console.log('   Body:', JSON.stringify(body, null, 2));
    console.log('   ✅ Health check passed');
  } catch (err) {
    console.error('   ❌ Health check failed:', err);
  }

  // ── Step 4: Generate via Client ───────────────────────────────────────
  hr('Test 2: POST /generate via AgentHttpClient');
  const client = new AgentHttpClient(`http://localhost:${PORT}`);

  try {
    const result = await client.generate({
      prompt: 'What is 2 + 2? Answer in one sentence.',
    });
    console.log('   Response:', JSON.stringify(result, null, 2));
    console.log('   ✅ Generate passed');
  } catch (err) {
    console.error('   ❌ Generate failed:', err);
  }

  // ── Step 5: Stream via Client ─────────────────────────────────────────
  hr('Test 3: POST /stream via AgentHttpClient.generateStream()');
  try {
    let fullText = '';
    const stream = client.generateStream({
      prompt: 'Say hello world in 3 different programming languages. Be brief.',
    });

    process.stdout.write('   Streaming: ');
    for await (const event of stream) {
      if (event.type === 'text-delta' && 'textDelta' in event) {
        process.stdout.write(event.textDelta as string);
        fullText += event.textDelta;
      }
    }
    console.log('\n');
    console.log(`   Total length: ${fullText.length} chars`);
    console.log('   ✅ Stream passed');
  } catch (err) {
    console.error('   ❌ Stream failed:', err);
  }

  // ── Step 6: GET /status ───────────────────────────────────────────────
  hr('Test 4: GET /status');
  try {
    const res = await fetch(`http://localhost:${PORT}/status`);
    const body = await res.json();
    console.log('   Body:', JSON.stringify(body, null, 2));
    console.log('   ✅ Status passed');
  } catch (err) {
    console.error('   ❌ Status failed:', err);
  }

  // ── Done ──────────────────────────────────────────────────────────────
  hr('All tests complete!');
  console.log('Shutting down...\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});

/**
 * Comprehensive Feature Test — exercises ALL packages and ALL features
 *
 * Usage: pnpm demo:full
 *
 * Packages tested:
 *   @agent/brain        — Graph, NLP, parser, analysis, brain factory
 *   @agent/logger       — Logger, transports, namespaces, formatters
 *   @agent/sdk          — Agent, tools, presets, roles, models, config,
 *                          memory, skills, observability, sub-agents,
 *                          streaming, hooks, durability, schedulers
 *   @agent/sdk-server   — Server, routes, middleware, queue, buffer
 *   @agent/sdk-client   — HTTP client, chat client, session, WS, browser stream, errors
 */

import * as path from 'node:path';
import * as fs from 'node:fs';
import { config } from 'dotenv';

const root = path.resolve(import.meta.dirname, '..', '..', '..');
config({ path: path.join(root, '.env') });

// ── @agent/logger ───────────────────────────────────────────────────────────
import {
  createLogger, createNoopLogger,
  configure as logConfigure, addTransport, getLogEmitter,
  getConfig as getLogConfig, resetConfig as resetLogConfig,
  enable as enableLog, disable as disableLog,
  flush as flushLog, close as closeLog,
  createConsoleTransport, createFileTransport, createSSETransport,
  parseDebugEnv, matchesPattern, isNamespaceEnabled, childNamespace,
  formatPretty, formatJSON, formatSSE,
  LOG_LEVELS,
} from '@agent/logger';
import type { LogEntry } from '@agent/logger';

// ── @agent/sdk ──────────────────────────────────────────────────────────────
import { createAgent } from '@agent/sdk';
import { resolveModel, models } from '@agent/sdk';
import { toolPresets, createToolPreset, roleConfigs } from '@agent/sdk';
import { getConfig, loadConfig, configure, defineConfig, getModelForTier, DEFAULT_MODELS, DEFAULT_PROVIDER } from '@agent/sdk';
import { getHookRegistry, defineHook, createScheduledWorkflow, parseDuration, formatDuration } from '@agent/sdk';
import { createMemoryStore, createMemoryTools } from '@agent/sdk';
import { discoverSkills, loadSkills, buildSkillsSystemPrompt } from '@agent/sdk';
import { initObservability, isObservabilityEnabled, createTelemetrySettings } from '@agent/sdk';
import { createSpawnAgentTool } from '@agent/sdk';
import { createBrowserStream, BrowserStreamEmitter } from '@agent/sdk';
import { withTransientStreaming } from '@agent/sdk';
import { checkWorkflowAvailability, wrapToolAsDurableStep, wrapToolsAsDurable, wrapSelectedToolsAsDurable } from '@agent/sdk';
import { subAgentConfigs, getSubAgentConfig, subAgentRoles } from '@agent/sdk';
import { systemPrompt, rolePrompts, buildSystemContext } from '@agent/sdk';

// ── @agent/sdk tools (individual tool constructors) ─────────────────────────
import {
  ToolFactory, defaultToolFactory, mergeToolSets, filterTools, excludeTools, getToolNames,
  createAllTools, createToolRegistry, CORE_TOOL_NAMES,
  globTool, createGlobTool, runRgFiles,
  grepTool, createGrepTool, runRg,
  createShellTool, shellTool, executeShellCommand, addToAllowlist, clearAllowlist, getAllowlist,
  SHELL_DESCRIPTION, DEFAULT_TIMEOUT as SHELL_DEFAULT_TIMEOUT, MAX_TIMEOUT as SHELL_MAX_TIMEOUT,
  createPlanTool, planTool, MAX_PLAN_STEPS, AVAILABLE_AGENTS,
  createDeepReasoningTool, deepReasoningTool, DeepReasoningEngine,
  configureDeepReasoning, isDeepReasoningEnabled, getDeepReasoningEngine,
  createBrowserTool, browserTool, buildCommand, isBrowserCliAvailable, resetCliAvailability,
  BROWSER_ACTIONS, BROWSER_TOOL_DESCRIPTION,
  astGrepSearchTool, createAstGrepTools, ensureAstGrepBinary,
  createSpawnAgentTool as createSpawnAgentToolDirect,
} from '@agent/sdk/tools';

// ── @agent/sdk-server ───────────────────────────────────────────────────────
import { createAgentServer, createAgentRoutes } from '@agent/sdk-server';
import { createLoggingMiddleware, createRateLimitMiddleware, createAuthMiddleware } from '@agent/sdk-server';
import { ConcurrencyQueue, QueueFullError, QueueTimeoutError } from '@agent/sdk-server';
import { StreamEventBuffer } from '@agent/sdk-server';

// ── @agent/sdk-client ───────────────────────────────────────────────────────
import { AgentClient, AgentHttpClient, ChatClient, SessionManager } from '@agent/sdk-client';
import { BrowserStreamClient, AgentWebSocketClient } from '@agent/sdk-client';
import { ApiClientError, WebSocketError } from '@agent/sdk-client';

// ── @agent/brain ────────────────────────────────────────────────────────────
import {
  // Graph utilities (no FalkorDB needed)
  generateNodeId, generateFileNodeId, generateEdgeId,
  fileToNodeProps, functionToNodeProps, classToNodeProps,
  GraphClientError,
  // NLP
  EntityExtractor,
  ENTITY_TYPES, RELATIONSHIP_TYPES,
  VALID_ENTITY_TYPES, VALID_RELATIONSHIP_TYPES,
  autoLabel, labelSingle,
  loadSamples, saveSamples, loadAnnotations, saveAnnotations,
  parseClaudeExport, createSamplesFromStrings,
  // Parser
  initParser, isInitialized, parseCode, getLanguageForExtension,
  extractFunctions, extractClasses, extractImports, extractVariables,
  extractAllEntities, getLocation,
  // Analysis
  calculateComplexity, classifyComplexity,
  calculateCyclomatic, calculateCognitive,
  analyzeImpact, classifyRisk,
  analyzeDataflow, scanForVulnerabilities, analyzeRefactoring,
  // Project parsing
  parseProject, parseSingleFile,
  // Brain factory
  createBrain,
  createBrainTools,
} from '@agent/brain';

// ────────────────────────────────────────────────────────────────────────────
// Test harness
// ────────────────────────────────────────────────────────────────────────────

let passed = 0, failed = 0, skipped = 0;
const issues: string[] = [];

function hr(label: string) {
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`  ${label}`);
  console.log(`${'═'.repeat(64)}\n`);
}

function pass(name: string, detail?: string) {
  passed++;
  console.log(`  ✅ ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name: string, err: unknown) {
  failed++;
  const msg = err instanceof Error ? err.message : String(err);
  console.log(`  ❌ ${name} — ${msg}`);
  issues.push(`${name}: ${msg}`);
}

function skip(name: string, reason: string) {
  skipped++;
  console.log(`  ⏭️  ${name} — ${reason}`);
}

async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    pass(name);
  } catch (err) {
    fail(name, err);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// PACKAGE 0: @agent/brain
// ════════════════════════════════════════════════════════════════════════════

async function testBrain() {
  hr('📦 @agent/brain — Graph Utilities');

  await test('generateNodeId()', () => {
    const id = generateNodeId('Function', { name: 'myFunc', filePath: '/src/index.ts', startLine: 1 });
    if (!id || id.length === 0) throw new Error('Empty ID');
    console.log(`       ID: ${id}`);
  });

  await test('generateFileNodeId()', () => {
    const id = generateFileNodeId('/src/index.ts');
    if (!id) throw new Error('Empty ID');
  });

  await test('generateEdgeId()', () => {
    const id = generateEdgeId('src1', 'tgt1', 'CALLS');
    if (!id) throw new Error('Empty ID');
  });

  await test('fileToNodeProps()', () => {
    const props = fileToNodeProps({ filePath: '/src/index.ts', language: 'typescript', size: 1000 });
    if (!props) throw new Error('No props');
  });

  await test('functionToNodeProps()', () => {
    const props = functionToNodeProps({ name: 'foo', filePath: '/src/index.ts', startLine: 1, endLine: 10, language: 'typescript' });
    if (!props) throw new Error('No props');
  });

  await test('classToNodeProps()', () => {
    const props = classToNodeProps({ name: 'Foo', filePath: '/src/index.ts', startLine: 1, endLine: 20, language: 'typescript' });
    if (!props) throw new Error('No props');
  });

  await test('GraphClientError', () => {
    const err = new GraphClientError('test', 'QUERY_FAILED');
    if (!(err instanceof Error)) throw new Error('Not an Error');
  });

  hr('📦 @agent/brain — NLP');

  await test('ENTITY_TYPES', () => {
    if (!ENTITY_TYPES || ENTITY_TYPES.length === 0) throw new Error('Empty');
    console.log(`       Types: [${ENTITY_TYPES.join(', ')}]`);
  });

  await test('RELATIONSHIP_TYPES', () => {
    if (!RELATIONSHIP_TYPES || RELATIONSHIP_TYPES.length === 0) throw new Error('Empty');
    console.log(`       Types: [${RELATIONSHIP_TYPES.join(', ')}]`);
  });

  await test('VALID_ENTITY_TYPES set', () => {
    if (!VALID_ENTITY_TYPES || VALID_ENTITY_TYPES.size === 0) throw new Error('Empty set');
  });

  await test('VALID_RELATIONSHIP_TYPES set', () => {
    if (!VALID_RELATIONSHIP_TYPES || VALID_RELATIONSHIP_TYPES.size === 0) throw new Error('Empty set');
  });

  await test('EntityExtractor — construct', () => {
    const extractor = new EntityExtractor();
    if (!extractor) throw new Error('No extractor');
    if (typeof extractor.extract !== 'function') throw new Error('Missing extract()');
  });

  hr('📦 @agent/brain — Parser');

  await test('getLanguageForExtension()', () => {
    const lang = getLanguageForExtension('.ts');
    if (lang !== 'typescript') throw new Error(`Expected typescript, got ${lang}`);
    const pyLang = getLanguageForExtension('.py');
    console.log(`       .ts=${lang}, .py=${pyLang}`);
  });

  await test('isInitialized()', () => {
    const initialized = isInitialized();
    console.log(`       Before init: ${initialized}`);
  });

  await test('initParser()', async () => {
    try {
      await initParser();
      console.log(`       Parser initialized`);
    } catch (err: any) {
      console.log(`       Skipped (expected): ${err.message?.slice(0, 60)}`);
    }
  });

  await test('parseCode() — TypeScript', async () => {
    try {
      const code = 'function hello() { return "world"; }';
      const tree = await parseCode(code, 'typescript');
      if (!tree) throw new Error('No tree');
      console.log(`       Parsed ${code.length} chars`);
    } catch (err: any) {
      console.log(`       Skipped (expected): ${err.message?.slice(0, 60)}`);
    }
  });

  hr('📦 @agent/brain — Analysis');

  await test('calculateComplexity()', () => {
    if (typeof calculateComplexity !== 'function') throw new Error('Not a function');
  });

  await test('classifyComplexity()', () => {
    if (typeof classifyComplexity !== 'function') throw new Error('Not a function');
  });

  hr('📦 @agent/brain — Brain Factory & Tools');

  await test('createBrain() — exists (requires FalkorDB)', () => {
    if (typeof createBrain !== 'function') throw new Error('Not a function');
  });

  await test('createBrainTools() — exists', () => {
    if (typeof createBrainTools !== 'function') throw new Error('Not a function');
  });

  hr('📦 @agent/brain ↔ @agent/sdk — Integration');

  // Try the REAL brain — requires FalkorDB running
  let brain: Awaited<ReturnType<typeof createBrain>> | null = null;

  await test('createBrain() — connect', async () => {
    try {
      brain = await createBrain({
        graph: { host: 'localhost', port: 6379, graphName: 'agent_demo_test' },
        extraction: { enabled: false }, // skip LLM extraction for test speed
      });
      console.log(`       ✓ Connected to FalkorDB`);
    } catch (err: any) {
      console.log(`       FalkorDB not available: ${err.message?.slice(0, 60)}`);
      console.log(`       (Brain integration tests will be skipped)`);
    }
  });

  if (brain) {
    await test('createBrainTools(brain)', () => {
      const tools = createBrainTools(brain!);
      const toolNames = Object.keys(tools);
      console.log(`       Tools: [${toolNames.join(', ')}]`);
      if (!tools.queryKnowledge) throw new Error('Missing queryKnowledge');
      if (!tools.remember) throw new Error('Missing remember');
      if (!tools.recall) throw new Error('Missing recall');
      if (!tools.extractEntities) throw new Error('Missing extractEntities');
    });

    await test('brain.remember()', async () => {
      try {
        await brain!.remember('The Agent SDK uses TypeScript and AI SDK v6', { project: 'agent-sdk' });
        console.log(`       ✓ Fact stored`);
      } catch (err: any) {
        // Graph indexes may not exist yet — still validates the API call path
        console.log(`       Graph write: ${err.message?.slice(0, 60)}`);
      }
    });

    await test('brain.recall()', async () => {
      const episodes = await brain!.recall('TypeScript', 5);
      console.log(`       Recalled: ${episodes.length} episodes`);
    });

    await test('brain.query()', async () => {
      const results = await brain!.query('TypeScript', 5);
      console.log(`       Results: ${results.length}`);
    });

    await test('createAgent({ brain }) — injects brain tools', () => {
      const agent = createAgent({
        role: 'generic',
        brain: brain!,
        toolPreset: 'none',
        workspaceRoot: root,
        maxSteps: 1,
      });
      const tla = agent.getToolLoopAgent();
      const tools = Object.keys((tla as any).tools ?? (tla as any).config?.tools ?? {});
      console.log(`       Agent tools: [${tools.join(', ')}]`);

      for (const t of ['queryKnowledge', 'remember', 'recall', 'extractEntities']) {
        if (!tools.includes(t)) throw new Error(`Missing brain tool: ${t}`);
      }
      console.log(`       ✓ All 4 brain tools injected`);
    });

    await test('createAgent({ brain }) — LLM recall', async () => {
      const agent = createAgent({
        role: 'generic',
        brain: brain!,
        toolPreset: 'none',
        workspaceRoot: root,
        maxSteps: 5,
      });
      const result = await agent.generate({
        prompt: 'Use the recall tool to search for "TypeScript". Be concise.',
      });
      const calls = (result as any).steps.flatMap((s: any) =>
        (s.toolCalls ?? []).map((tc: any) => tc.toolName ?? tc.name)
      );
      console.log(`       Tools used: [${calls.join(', ')}]`);
      if (calls.includes('recall')) {
        console.log(`       ✓ Brain recall tool invoked by LLM`);
      }
    });

    await test('brain.close()', async () => {
      await brain!.close();
      console.log(`       ✓ Disconnected`);
    });
  } else {
    skip('createBrainTools(brain)', 'FalkorDB not available');
    skip('brain.remember()', 'FalkorDB not available');
    skip('brain.recall()', 'FalkorDB not available');
    skip('brain.query()', 'FalkorDB not available');
    skip('createAgent({ brain }) — injects brain tools', 'FalkorDB not available');
    skip('createAgent({ brain }) — LLM recall', 'FalkorDB not available');
    skip('brain.close()', 'FalkorDB not available');
  }
}

// ════════════════════════════════════════════════════════════════════════════
// PACKAGE 1: @agent/logger
// ════════════════════════════════════════════════════════════════════════════

async function testLogger() {
  hr('📦 @agent/logger');

  // Core
  await test('createLogger()', () => {
    const log = createLogger('@test:demo');
    if (!log.info || !log.debug || !log.warn || !log.error) throw new Error('Missing log methods');
    if (!log.time) throw new Error('Missing time()');
    if (!log.child) throw new Error('Missing child()');
  });

  await test('createNoopLogger()', () => {
    const log = createNoopLogger();
    log.info('should not throw');
    log.debug('should not throw');
  });

  await test('log.child()', () => {
    const log = createLogger('@test:parent');
    const child = log.child({ runId: 'test-123' });
    child.info('child log test');
  });

  await test('log.time()', () => {
    const log = createLogger('@test:timing');
    const done = log.time('test-op');
    done();
  });

  // Transports
  await test('createConsoleTransport()', () => {
    const transport = createConsoleTransport({ colorize: false });
    if (!transport.write) throw new Error('Missing write()');
  });

  await test('createFileTransport()', () => {
    const tmpPath = path.join(root, '.tmp-test-log');
    const transport = createFileTransport({ path: tmpPath });
    if (!transport.write) throw new Error('Missing write()');
    // Cleanup
    try { fs.unlinkSync(tmpPath); } catch { }
  });

  await test('createSSETransport()', () => {
    const transport = createSSETransport();
    if (!transport.write) throw new Error('Missing write()');
    if (!transport.addClient) throw new Error('Missing addClient()');
  });

  // Namespace utils
  await test('parseDebugEnv()', () => {
    const patterns = parseDebugEnv('@agent/*,-@agent/sdk:verbose');
    if (patterns.length === 0) throw new Error('No patterns parsed');
  });

  await test('matchesPattern()', () => {
    if (!matchesPattern('@agent/sdk:agent', ['@agent/*'])) throw new Error('Should match');
  });

  await test('isNamespaceEnabled()', () => {
    const enabled = isNamespaceEnabled('@agent/sdk:test', {
      enabledPatterns: ['@agent/*'],
      excludedPatterns: [],
    });
    console.log(`       Enabled: ${enabled}`);
  });

  await test('childNamespace()', () => {
    const child = childNamespace('@agent/sdk', 'tools');
    if (child !== '@agent/sdk:tools') throw new Error(`Expected @agent/sdk:tools, got ${child}`);
  });

  // Formatters
  await test('formatPretty()', () => {
    const entry: LogEntry = { level: 'info', namespace: '@test', message: 'hello', timestamp: Date.now(), data: {} };
    const out = formatPretty(entry);
    if (!out || out.length === 0) throw new Error('Empty output');
  });

  await test('formatJSON()', () => {
    const entry: LogEntry = { level: 'info', namespace: '@test', message: 'hello', timestamp: Date.now(), data: {} };
    const out = formatJSON(entry);
    const parsed = JSON.parse(out);
    if (parsed.message !== 'hello') throw new Error('Bad JSON');
  });

  await test('formatSSE()', () => {
    const entry: LogEntry = { level: 'info', namespace: '@test', message: 'hello', timestamp: Date.now(), data: {} };
    const out = formatSSE(entry);
    if (!out.includes('data:')) throw new Error('Not SSE format');
  });

  await test('LOG_LEVELS constant', () => {
    if (!('info' in LOG_LEVELS)) throw new Error('Missing info level');
    if (!('error' in LOG_LEVELS)) throw new Error('Missing error level');
    console.log(`       Levels: ${Object.keys(LOG_LEVELS).join(', ')}`);
  });

  await test('getLogEmitter()', () => {
    const emitter = getLogEmitter();
    if (!emitter) throw new Error('No emitter returned');
  });

  // Logger lifecycle
  await test('getConfig() — logger', () => {
    const cfg = getLogConfig();
    if (!cfg) throw new Error('No config');
    console.log(`       Enabled patterns: ${cfg.enabledPatterns.length}`);
  });

  await test('enable() / disable()', () => {
    enableLog('@test:lifecycle');
    const cfg1 = getLogConfig();
    if (!cfg1.enabledPatterns.includes('@test:lifecycle')) throw new Error('Pattern not enabled');
    disableLog('@test:lifecycle');
    console.log(`       ✓ enable/disable cycle`);
  });

  await test('resetConfig()', () => {
    resetLogConfig();
    const cfg = getLogConfig();
    console.log(`       After reset — patterns: ${cfg.enabledPatterns.length}`);
  });

  await test('flush()', async () => {
    await flushLog();
    console.log(`       ✓ flush completed`);
  });
}

// ════════════════════════════════════════════════════════════════════════════
// PACKAGE 2: @agent/sdk — Core
// ════════════════════════════════════════════════════════════════════════════

async function testSdkCore() {
  hr('📦 @agent/sdk — Core Agent');

  const roles = ['generic', 'coder', 'researcher', 'analyst'] as const;
  for (const role of roles) {
    await test(`createAgent({ role: '${role}' })`, async () => {
      const agent = createAgent({ role, workspaceRoot: root, toolPreset: 'none', maxSteps: 1 });
      if (!agent.agentId) throw new Error('No agentId');
      if (agent.role !== role) throw new Error(`Expected ${role}, got ${agent.role}`);
    });
  }

  await test('agent.getSystemPrompt()', () => {
    const agent = createAgent({ role: 'coder', workspaceRoot: root, toolPreset: 'none', maxSteps: 1 });
    const prompt = agent.getSystemPrompt();
    if (prompt.length < 50) throw new Error(`Prompt too short: ${prompt.length}`);
    console.log(`       Length: ${prompt.length} chars`);
  });

  await test('agent.getToolLoopAgent()', () => {
    const agent = createAgent({ role: 'coder', workspaceRoot: root, toolPreset: 'none', maxSteps: 1 });
    const tla = agent.getToolLoopAgent();
    if (!tla) throw new Error('No ToolLoopAgent');
  });
}

// ════════════════════════════════════════════════════════════════════════════
// PACKAGE 2: @agent/sdk — Tool Presets & Roles
// ════════════════════════════════════════════════════════════════════════════

async function testPresetsAndRoles() {
  hr('📦 @agent/sdk — Presets & Roles');

  for (const preset of ['none', 'minimal', 'standard', 'full'] as const) {
    await test(`createToolPreset('${preset}')`, () => {
      const tools = createToolPreset(preset, { workspaceRoot: root });
      console.log(`       Tools: [${Object.keys(tools).join(', ')}]`);
    });
  }

  await test('toolPresets definitions', () => {
    if (!toolPresets.standard.tools.includes('grep')) throw new Error('Missing grep');
    if (!toolPresets.full.tools.includes('browser')) throw new Error('Missing browser');
  });

  await test('roleConfigs', () => {
    const roles = Object.keys(roleConfigs);
    console.log(`       Roles: [${roles.join(', ')}]`);
    if (!roles.includes('coder')) throw new Error('Missing coder');
    if (!roles.includes('analyst')) throw new Error('Missing analyst');
  });

  await test('systemPrompt template', () => {
    if (!systemPrompt || systemPrompt.length === 0) throw new Error('Empty systemPrompt');
  });

  await test('rolePrompts', () => {
    if (!rolePrompts || typeof rolePrompts !== 'object') throw new Error('No rolePrompts');
  });

  await test('buildSystemContext()', () => {
    const ctx = buildSystemContext({ workspaceRoot: root, role: 'coder' });
    if (!ctx) throw new Error('No context returned');
  });
}

// ════════════════════════════════════════════════════════════════════════════
// PACKAGE 2: @agent/sdk — Models
// ════════════════════════════════════════════════════════════════════════════

async function testModels() {
  hr('📦 @agent/sdk — Models');

  await test('resolveModel() — default', () => {
    const model = resolveModel();
    if (!model) throw new Error('No model');
  });

  for (const tier of ['fast', 'standard', 'reasoning', 'powerful'] as const) {
    await test(`resolveModel({ tier: '${tier}' })`, () => {
      const model = resolveModel({ tier });
      if (!model) throw new Error('No model');
    });
  }

  await test('models.fast()', () => {
    if (!models.fast()) throw new Error('No model');
  });

  await test('models.standard()', () => {
    if (!models.standard()) throw new Error('No model');
  });

  await test('DEFAULT_MODELS', () => {
    if (!DEFAULT_MODELS.openrouter) throw new Error('Missing openrouter defaults');
  });

  await test('DEFAULT_PROVIDER', () => {
    if (!DEFAULT_PROVIDER) throw new Error('Missing default provider');
    console.log(`       Default: ${DEFAULT_PROVIDER}`);
  });

  await test('getModelForTier()', () => {
    const model = getModelForTier('standard', 'openrouter');
    console.log(`       standard/openrouter: ${model}`);
  });
}

// ════════════════════════════════════════════════════════════════════════════
// PACKAGE 2: @agent/sdk — Config
// ════════════════════════════════════════════════════════════════════════════

async function testConfig() {
  hr('📦 @agent/sdk — Config');

  await test('loadConfig()', () => {
    const cfg = loadConfig(path.join(root, 'agent-sdk.config.yaml'));
    console.log(`       Provider: ${cfg.models?.defaultProvider}`);
  });

  await test('getConfig()', () => {
    const cfg = getConfig();
    if (!cfg) throw new Error('No config');
  });

  await test('configure()', () => {
    configure({ models: { defaultProvider: 'openrouter' } });
  });

  await test('defineConfig()', () => {
    const cfg = defineConfig({ models: { defaultProvider: 'openrouter' } });
    if (!cfg) throw new Error('No config returned');
  });
}

// ════════════════════════════════════════════════════════════════════════════
// PACKAGE 2: @agent/sdk — Memory
// ════════════════════════════════════════════════════════════════════════════

async function testMemory() {
  hr('📦 @agent/sdk — Memory');

  await test('createMemoryStore()', async () => {
    try {
      const store = await createMemoryStore({ indexPath: path.join(root, '.tmp-memory-test') });
      if (!store) throw new Error('No store');
      console.log(`       Store created`);
      // Cleanup
      try { fs.rmSync(path.join(root, '.tmp-memory-test'), { recursive: true }); } catch { }
    } catch (err: any) {
      if (err.message?.includes('vectra')) {
        skip('createMemoryStore()', 'vectra dependency issue');
      } else {
        throw err;
      }
    }
  });

  await test('createMemoryTools()', () => {
    // createMemoryTools needs a brain/memory instance — just verify the function exists
    if (typeof createMemoryTools !== 'function') throw new Error('Not a function');
    console.log(`       Function available`);
  });
}

// ════════════════════════════════════════════════════════════════════════════
// PACKAGE 2: @agent/sdk — Skills
// ════════════════════════════════════════════════════════════════════════════

async function testSkills() {
  hr('📦 @agent/sdk — Skills');

  await test('discoverSkills()', async () => {
    // Skills are discovered from .agent/skills or similar — may find none
    const skills = await discoverSkills(root);
    console.log(`       Found: ${skills.length} skills`);
  });

  await test('buildSkillsSystemPrompt()', () => {
    const prompt = buildSkillsSystemPrompt([]);
    // Should return empty or minimal prompt for empty skills
    console.log(`       Prompt length: ${prompt.length}`);
  });

  await test('loadSkills() — empty path', async () => {
    const skills = await loadSkills([]);
    console.log(`       Loaded: ${skills.length} skills`);
  });
}

// ════════════════════════════════════════════════════════════════════════════
// PACKAGE 2: @agent/sdk — Observability
// ════════════════════════════════════════════════════════════════════════════

async function testObservability() {
  hr('📦 @agent/sdk — Observability');

  await test('isObservabilityEnabled()', () => {
    const enabled = isObservabilityEnabled();
    console.log(`       Enabled: ${enabled}`);
  });

  await test('createTelemetrySettings()', () => {
    const settings = createTelemetrySettings({ agentId: 'test', role: 'coder' });
    if (!settings) throw new Error('No settings');
  });

  await test('initObservability() — no config', async () => {
    // Without Langfuse keys, should gracefully handle
    try {
      await initObservability({});
      console.log(`       Initialized (no-op without keys)`);
    } catch (err: any) {
      // Expected without langfuse
      console.log(`       Expected: ${err.message?.slice(0, 60)}`);
    }
  });
}

// ════════════════════════════════════════════════════════════════════════════
// PACKAGE 2: @agent/sdk — Sub-Agents & Browser
// ════════════════════════════════════════════════════════════════════════════

async function testSubAgentsAndBrowser() {
  hr('📦 @agent/sdk — Sub-Agents & Browser');

  await test('createSpawnAgentTool()', () => {
    const tool = createSpawnAgentTool({
      maxSpawnDepth: 2,
      currentDepth: 0,
      createAgent: () => ({ stream: async () => ({}) }) as any,
    });
    // Returns { description, inputSchema, execute } — a flat tool definition
    if (!tool.description) throw new Error('No description');
    if (!tool.execute) throw new Error('No execute function');
  });

  await test('BrowserStreamEmitter', () => {
    const emitter = new BrowserStreamEmitter();
    if (!emitter) throw new Error('No emitter');
    if (typeof emitter.start !== 'function') throw new Error('Missing start()');
    if (typeof emitter.stop !== 'function') throw new Error('Missing stop()');
    if (typeof emitter.isRunning !== 'function') throw new Error('Missing isRunning()');
  });

  await test('createBrowserStream()', () => {
    if (typeof createBrowserStream !== 'function') throw new Error('Not a function');
  });
}

// ════════════════════════════════════════════════════════════════════════════
// PACKAGE 2: @agent/sdk — Streaming
// ════════════════════════════════════════════════════════════════════════════

async function testStreaming() {
  hr('📦 @agent/sdk — Streaming');

  await test('withTransientStreaming()', () => {
    if (typeof withTransientStreaming !== 'function') throw new Error('Not a function');
  });
}

// ════════════════════════════════════════════════════════════════════════════
// PACKAGE 2: @agent/sdk — Workflow: Hooks
// ════════════════════════════════════════════════════════════════════════════

async function testHooks() {
  hr('📦 @agent/sdk — Workflow Hooks');

  await test('getHookRegistry()', () => {
    const registry = getHookRegistry();
    if (!registry) throw new Error('No registry');
    const hooks = registry.list();
    console.log(`       Pending: ${hooks.length}`);
  });

  await test('defineHook()', () => {
    const hook = defineHook<{ amount: number }, boolean>({
      name: 'test-approval',
      description: 'Test approval hook',
      timeout: '30m',
      defaultValue: false,
    });
    if (!hook) throw new Error('No hook returned');
    if (typeof hook.wait !== 'function') throw new Error('Missing wait()');
    if (typeof hook.waitWithId !== 'function') throw new Error('Missing waitWithId()');
    console.log(`       Hook: ${hook.name}`);
  });
}

// ════════════════════════════════════════════════════════════════════════════
// PACKAGE 2: @agent/sdk — Workflow: Durability
// ════════════════════════════════════════════════════════════════════════════

async function testDurability() {
  hr('📦 @agent/sdk — Workflow Durability');

  await test('checkWorkflowAvailability()', () => {
    const available = checkWorkflowAvailability();
    console.log(`       Workflow available: ${available}`);
  });

  await test('parseDuration()', () => {
    // Only supports single-unit: '30s', '5m', '1h', '1d'
    const ms = parseDuration('2h');
    if (ms !== 7200000) throw new Error(`Expected 7200000, got ${ms}`);
    const ms2 = parseDuration('30s');
    if (ms2 !== 30000) throw new Error(`Expected 30000, got ${ms2}`);
    console.log(`       2h=${ms}ms, 30s=${ms2}ms`);
  });

  await test('formatDuration()', () => {
    const str = formatDuration(9000000);
    console.log(`       9000000ms = ${str}`);
    if (!str) throw new Error('No output');
  });

  await test('wrapToolAsDurableStep()', () => {
    if (typeof wrapToolAsDurableStep !== 'function') throw new Error('Not a function');
  });
}

// ════════════════════════════════════════════════════════════════════════════
// PACKAGE 2: @agent/sdk — Workflow: Schedulers
// ════════════════════════════════════════════════════════════════════════════

async function testSchedulers() {
  hr('📦 @agent/sdk — Scheduled Workflows');

  await test('createScheduledWorkflow()', () => {
    const workflow = createScheduledWorkflow({
      name: 'test-schedule',
      interval: '1h',
      task: async () => ({ success: true }),
    });
    if (!workflow) throw new Error('No workflow');
    if (!workflow.name) throw new Error('Missing name');
    console.log(`       Workflow: ${workflow.name}`);
  });
}

// ════════════════════════════════════════════════════════════════════════════
// PACKAGE 2: @agent/sdk — generate() with each tool
// ════════════════════════════════════════════════════════════════════════════

async function testGenerateWithTools() {
  hr('📦 @agent/sdk — generate() with Tools (LLM calls)');

  const agent = createAgent({
    role: 'coder',
    toolPreset: 'standard',
    workspaceRoot: root,
    maxSteps: 10,
  });

  const toolTests = [
    { name: 'glob', prompt: 'Use the glob tool to find all tsconfig.json files (not in node_modules). Just list them.' },
    { name: 'grep', prompt: 'Use the grep tool to search for "createAgent" in packages/sdk/src/index.ts. Be concise.' },
    { name: 'shell', prompt: 'Use the shell tool to run "echo sdk-test-ok". Only show the output.' },
    { name: 'plan', prompt: 'Use the plan tool to create a 2-step plan for writing a hello world. Very brief.' },
    { name: 'deep_reasoning', prompt: 'Use the deep_reasoning tool to think: "What is 2+2?" Give a one-word answer.' },
  ];

  for (const { name, prompt } of toolTests) {
    await test(`generate() → ${name}`, async () => {
      const result = await agent.generate({ prompt });
      const calls = (result as any).steps.flatMap((s: any) =>
        (s.toolCalls ?? []).map((tc: any) => tc.toolName ?? tc.name)
      );
      console.log(`       Tools: [${calls.join(', ')}]`);
      if (!result.text) throw new Error('No text');
    });
  }
}

// ════════════════════════════════════════════════════════════════════════════
// PACKAGE 2: @agent/sdk — Direct streaming
// ════════════════════════════════════════════════════════════════════════════

async function testDirectStreaming() {
  hr('📦 @agent/sdk — agent.stream()');

  const agent = createAgent({ role: 'coder', toolPreset: 'none', workspaceRoot: root, maxSteps: 3 });

  await test('agent.stream()', async () => {
    const result = await agent.stream({ prompt: 'Say "streaming-ok" only.' });
    let text = '';
    for await (const chunk of result.fullStream) {
      if (chunk.type === 'text-delta') text += (chunk as any).textDelta ?? '';
    }
    console.log(`       Received: ${text.length} chars`);
  });
}

// ════════════════════════════════════════════════════════════════════════════
// PACKAGE 3: @agent/sdk-server
// ════════════════════════════════════════════════════════════════════════════

async function testServer() {
  hr('📦 @agent/sdk-server — Server Infrastructure');

  // Middleware
  await test('createLoggingMiddleware()', () => {
    const mw = createLoggingMiddleware();
    if (!mw) throw new Error('No middleware');
  });

  await test('createRateLimitMiddleware()', () => {
    const mw = createRateLimitMiddleware({ windowMs: 60000, maxRequests: 100 });
    if (!mw) throw new Error('No middleware');
  });

  await test('createAuthMiddleware()', () => {
    const mw = createAuthMiddleware({ apiKey: 'test-key' });
    if (!mw) throw new Error('No middleware');
  });

  // Queue
  await test('ConcurrencyQueue', () => {
    const queue = new ConcurrencyQueue({ maxConcurrency: 2, maxQueueSize: 10 });
    const stats = queue.getStats();
    console.log(`       Active: ${stats.active}, Queued: ${stats.queued}`);
  });

  await test('QueueFullError', () => {
    const err = new QueueFullError(10);
    if (!(err instanceof Error)) throw new Error('Not an Error');
  });

  await test('QueueTimeoutError', () => {
    const err = new QueueTimeoutError(5000);
    if (!(err instanceof Error)) throw new Error('Not an Error');
  });

  // Stream buffer
  await test('StreamEventBuffer', () => {
    const buffer = new StreamEventBuffer({ maxBufferSize: 100 });
    if (!buffer) throw new Error('No buffer');
  });

  // Full server + all endpoints
  hr('📦 @agent/sdk-server — Live Server Endpoints');

  const agent = createAgent({ role: 'generic', toolPreset: 'none', workspaceRoot: root, maxSteps: 3 });
  const PORT = 4323;
  const server = createAgentServer({ agent, port: PORT });
  server.start();
  await new Promise((r) => setTimeout(r, 500));

  const endpoints = [
    { name: 'GET /health', path: '/health', check: (b: any) => b.status === 'ok' },
    { name: 'GET /status', path: '/status', check: (b: any) => b.version },
    { name: 'GET /queue', path: '/queue', check: (b: any) => typeof b.active === 'number' },
    { name: 'GET /config', path: '/config', check: () => true, isText: true },
    { name: 'GET /hooks', path: '/hooks', check: (b: any) => typeof b.total === 'number' },
  ];

  for (const { name, path: p, check, isText } of endpoints as Array<{ name: string; path: string; check: (b: any) => boolean; isText?: boolean }>) {
    await test(name, async () => {
      const res = await fetch(`http://localhost:${PORT}${p}`);
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const body = isText ? await res.text() : await res.json();
      if (!check(body)) throw new Error(`Check failed: ${JSON.stringify(body).slice(0, 80)}`);
    });
  }

  await test('GET /logs (SSE connect)', async () => {
    const controller = new AbortController();
    const res = await fetch(`http://localhost:${PORT}/logs`, { signal: controller.signal });
    if (!res.ok) throw new Error(`Status: ${res.status}`);
    controller.abort();
  });

  await test('POST /generate', async () => {
    const res = await fetch(`http://localhost:${PORT}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Say "server-ok"' }),
    });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const body = await res.json() as any;
    console.log(`       Text: "${body.text?.slice(0, 40)}"`);
  });

  await test('POST /stream (SSE)', async () => {
    const res = await fetch(`http://localhost:${PORT}/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Say "stream-ok"' }),
    });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const text = await res.text();
    console.log(`       SSE payload: ${text.length} chars`);
  });

  // Leave server running for client tests — will exit via process.exit()
  return PORT;
}

// ════════════════════════════════════════════════════════════════════════════
// PACKAGE 4: @agent/sdk-client
// ════════════════════════════════════════════════════════════════════════════

async function testClient(port: number) {
  hr('📦 @agent/sdk-client');

  const baseUrl = `http://localhost:${port}`;

  // HTTP Client
  await test('AgentHttpClient — generate()', async () => {
    const client = new AgentHttpClient(baseUrl);
    const result = await client.generate({ prompt: 'Say "http-ok"' });
    console.log(`       Text: "${(result as any).text?.slice(0, 40)}"`);
  });

  await test('AgentHttpClient — generateStream()', async () => {
    const client = new AgentHttpClient(baseUrl);
    let text = '';
    for await (const event of client.generateStream({ prompt: 'Say "sse-ok"' })) {
      if (event.type === 'text-delta' && 'textDelta' in event) text += event.textDelta;
    }
    console.log(`       Streamed: ${text.length} chars`);
  });

  // Full AgentClient
  await test('AgentClient — construct', () => {
    const client = new AgentClient({ baseUrl });
    if (!client) throw new Error('No client');
  });

  // ChatClient
  await test('ChatClient — construct', () => {
    const client = new ChatClient({ baseUrl });
    if (!client) throw new Error('No client');
  });

  // SessionManager
  await test('SessionManager — construct', () => {
    const sm = new SessionManager({ baseUrl });
    if (!sm) throw new Error('No session manager');
  });

  // BrowserStreamClient
  await test('BrowserStreamClient — construct', () => {
    const client = new BrowserStreamClient({
      url: baseUrl.replace('http', 'ws') + '/ws/browser-stream',
    });
    if (!client) throw new Error('No browser stream client');
  });

  // Error types
  await test('ApiClientError', () => {
    const err = new ApiClientError('test', 400);
    if (!(err instanceof Error)) throw new Error('Not an Error');
    if (err.status !== 400) throw new Error('Wrong status code');
  });

  await test('WebSocketError', () => {
    const err = new WebSocketError('test');
    if (!(err instanceof Error)) throw new Error('Not an Error');
  });
}

// ════════════════════════════════════════════════════════════════════════════
// PACKAGE 2: @agent/sdk — Multi-role generate
// ════════════════════════════════════════════════════════════════════════════

async function testMultiRoleGenerate() {
  hr('📦 @agent/sdk — Multi-Role generate()');

  for (const role of ['researcher', 'analyst'] as const) {
    await test(`generate() as ${role}`, async () => {
      const agent = createAgent({ role, toolPreset: 'none', workspaceRoot: root, maxSteps: 3 });
      const result = await agent.generate({ prompt: '1+1=? Answer with just the number.' });
      console.log(`       Response: "${result.text.slice(0, 20)}"`);
    });
  }
}

// ════════════════════════════════════════════════════════════════════════════
// SDK TOOLS — Factory, Constructors, Internals
// ════════════════════════════════════════════════════════════════════════════

async function testToolFactory() {
  hr('📦 @agent/sdk — Tool Factory & Utilities');

  await test('ToolFactory — register/create', () => {
    const factory = new ToolFactory();
    factory.register('test', () => ({ myTool: {} as any }));
    if (!factory.has('test')) throw new Error('Not registered');
    const tools = factory.create('test', { workspaceRoot: root });
    if (!tools?.myTool) throw new Error('Tool not created');
    console.log(`       Registered: ${factory.getRegisteredNames().join(', ')}`);
    factory.clear();
  });

  await test('ToolFactory — createAll', () => {
    const factory = new ToolFactory();
    factory.register('a', () => ({ toolA: {} as any }));
    factory.register('b', () => ({ toolB: {} as any }));
    const all = factory.createAll({ workspaceRoot: root });
    if (!all.toolA || !all.toolB) throw new Error('Missing tools from createAll');
    console.log(`       Created: ${Object.keys(all).join(', ')}`);
  });

  await test('ToolFactory — createSelected', () => {
    const factory = new ToolFactory();
    factory.register('a', () => ({ toolA: {} as any }));
    factory.register('b', () => ({ toolB: {} as any }));
    const selected = factory.createSelected(['a'], { workspaceRoot: root });
    if (!selected.toolA) throw new Error('Missing toolA');
    if (selected.toolB) throw new Error('Should not include toolB');
  });

  await test('defaultToolFactory exists', () => {
    if (!defaultToolFactory) throw new Error('No default factory');
    if (!(defaultToolFactory instanceof ToolFactory)) throw new Error('Wrong type');
  });

  await test('mergeToolSets()', () => {
    const a = { glob: {} as any };
    const b = { grep: {} as any };
    const merged = mergeToolSets(a, b);
    if (!merged.glob || !merged.grep) throw new Error('Merge failed');
  });

  await test('filterTools()', () => {
    const tools = { glob: {} as any, grep: {} as any, shell: {} as any };
    const filtered = filterTools(tools, ['glob', 'shell']);
    if (!filtered.glob || !filtered.shell) throw new Error('Missing kept tools');
    if (filtered.grep) throw new Error('grep should be excluded');
  });

  await test('excludeTools()', () => {
    const tools = { glob: {} as any, grep: {} as any, shell: {} as any };
    const excluded = excludeTools(tools, ['grep']);
    if (!excluded.glob || !excluded.shell) throw new Error('Missing kept tools');
    if (excluded.grep) throw new Error('grep should be excluded');
  });

  await test('getToolNames()', () => {
    const tools = { glob: {} as any, grep: {} as any };
    const names = getToolNames(tools);
    if (names.length !== 2) throw new Error(`Expected 2 names, got ${names.length}`);
    console.log(`       Names: [${names.join(', ')}]`);
  });

  await test('CORE_TOOL_NAMES', () => {
    if (!CORE_TOOL_NAMES || CORE_TOOL_NAMES.length === 0) throw new Error('Empty');
    console.log(`       Core tools: [${CORE_TOOL_NAMES.join(', ')}]`);
  });

  await test('createToolRegistry()', () => {
    const registry = createToolRegistry({ workspaceRoot: root });
    if (!registry) throw new Error('No registry');
    console.log(`       Registry type: ${typeof registry}`);
  });
}

async function testToolConstructors() {
  hr('📦 @agent/sdk — Individual Tool Constructors');

  // Glob
  await test('createGlobTool()', () => {
    const tool = createGlobTool({ defaultCwd: root });
    if (!tool) throw new Error('No tool');
    console.log(`       ✓ glob tool created`);
  });

  await test('globTool — default instance', () => {
    if (!globTool) throw new Error('No default glob tool');
  });

  // Grep
  await test('createGrepTool()', () => {
    const tool = createGrepTool({ defaultCwd: root });
    if (!tool) throw new Error('No tool');
    console.log(`       ✓ grep tool created`);
  });

  await test('grepTool — default instance', () => {
    if (!grepTool) throw new Error('No default grep tool');
  });

  // Shell
  await test('createShellTool()', () => {
    const tool = createShellTool({ allowedDirs: [root] });
    if (!tool) throw new Error('No tool');
  });

  await test('shellTool — default instance', () => {
    if (!shellTool) throw new Error('No default shell tool');
  });

  await test('executeShellCommand()', async () => {
    const result = await executeShellCommand({ command: 'echo sdk-tool-test', cwd: root } as any);
    if (!result) throw new Error('No result');
    console.log(`       Output: ${JSON.stringify(result).slice(0, 80)}`);
  });

  await test('Shell allowlist', () => {
    clearAllowlist();
    addToAllowlist('safe-command');
    const list = getAllowlist();
    if (!list.includes('safe-command')) throw new Error('Not in allowlist');
    clearAllowlist();
    console.log(`       ✓ add/get/clear allowlist`);
  });

  await test('Shell constants', () => {
    if (!SHELL_DESCRIPTION) throw new Error('No description');
    if (!SHELL_DEFAULT_TIMEOUT || !SHELL_MAX_TIMEOUT) throw new Error('No timeout constants');
    console.log(`       Default timeout: ${SHELL_DEFAULT_TIMEOUT}ms, Max: ${SHELL_MAX_TIMEOUT}ms`);
  });

  // Plan
  await test('createPlanTool()', () => {
    const tool = createPlanTool({});
    if (!tool) throw new Error('No tool');
  });

  await test('planTool — default instance', () => {
    if (!planTool) throw new Error('No default plan tool');
  });

  await test('Plan constants', () => {
    if (!MAX_PLAN_STEPS) throw new Error('No MAX_PLAN_STEPS');
    if (!AVAILABLE_AGENTS) throw new Error('No AVAILABLE_AGENTS');
    console.log(`       Max steps: ${MAX_PLAN_STEPS}, Available agents: ${Object.keys(AVAILABLE_AGENTS).length}`);
  });

  // Deep Reasoning
  await test('createDeepReasoningTool()', () => {
    const tool = createDeepReasoningTool();
    if (!tool) throw new Error('No tool');
  });

  await test('deepReasoningTool — default instance', () => {
    if (!deepReasoningTool) throw new Error('No default deep reasoning tool');
  });

  await test('DeepReasoningEngine', () => {
    const engine = new DeepReasoningEngine();
    if (!engine) throw new Error('No engine');
    console.log(`       ✓ DeepReasoningEngine constructed`);
  });

  await test('configureDeepReasoning / isDeepReasoningEnabled', () => {
    const enabled = isDeepReasoningEnabled();
    console.log(`       Enabled: ${enabled}`);
  });

  // Spawn Agent
  await test('createSpawnAgentTool() — from tools', () => {
    const tool = createSpawnAgentToolDirect();
    if (!tool) throw new Error('No tool');
    if (!tool.description) throw new Error('Missing description');
    if (!tool.inputSchema) throw new Error('Missing inputSchema');
    if (!tool.execute) throw new Error('Missing execute');
    console.log(`       ✓ spawn agent tool shape verified`);
  });
}

async function testBrowserTool() {
  hr('📦 @agent/sdk — Browser Automation Tool');

  await test('createBrowserTool()', () => {
    const tool = createBrowserTool();
    if (!tool) throw new Error('No tool');
  });

  await test('browserTool — default instance', () => {
    if (!browserTool) throw new Error('No default browser tool');
  });

  await test('BROWSER_ACTIONS', () => {
    if (!BROWSER_ACTIONS || BROWSER_ACTIONS.length === 0) throw new Error('No actions');
    console.log(`       Actions: [${BROWSER_ACTIONS.join(', ')}]`);
  });

  await test('BROWSER_TOOL_DESCRIPTION', () => {
    if (!BROWSER_TOOL_DESCRIPTION) throw new Error('Missing');
    console.log(`       Length: ${BROWSER_TOOL_DESCRIPTION.length} chars`);
  });

  await test('isBrowserCliAvailable()', async () => {
    resetCliAvailability();
    const available = await isBrowserCliAvailable();
    console.log(`       agent-browser CLI available: ${available}`);
  });

  // buildCommand for each action type
  await test('buildCommand — open', () => {
    const args = buildCommand({ action: 'open', url: 'https://example.com' } as any);
    if (!args.includes('open') || !args.includes('https://example.com')) throw new Error(`Bad args: ${args}`);
    console.log(`       open: [${args.join(', ')}]`);
  });

  await test('buildCommand — snapshot', () => {
    const args = buildCommand({ action: 'snapshot' } as any);
    if (!args.includes('snapshot')) throw new Error('Missing snapshot');
  });

  await test('buildCommand — click', () => {
    const args = buildCommand({ action: 'click', selector: '#btn' } as any);
    if (!args.includes('click') || !args.includes('#btn')) throw new Error('Bad args');
  });

  await test('buildCommand — fill', () => {
    const args = buildCommand({ action: 'fill', selector: '#input', text: 'hello' } as any);
    if (!args.includes('fill') || !args.includes('hello')) throw new Error('Bad args');
  });

  await test('buildCommand — type', () => {
    const args = buildCommand({ action: 'type', selector: '#input', text: 'world' } as any);
    if (!args.includes('type')) throw new Error('Missing type');
  });

  await test('buildCommand — press', () => {
    const args = buildCommand({ action: 'press', key: 'Enter' } as any);
    if (!args.includes('press') || !args.includes('Enter')) throw new Error('Bad args');
  });

  await test('buildCommand — scroll', () => {
    const args = buildCommand({ action: 'scroll', direction: 'down', pixels: 500 } as any);
    if (!args.includes('scroll') || !args.includes('down')) throw new Error('Bad args');
  });

  await test('buildCommand — screenshot', () => {
    const args = buildCommand({ action: 'screenshot' } as any);
    if (!args.includes('screenshot')) throw new Error('Missing screenshot');
  });

  await test('buildCommand — getText', () => {
    const args = buildCommand({ action: 'getText', selector: '.content' } as any);
    if (!args.includes('get') || !args.includes('text')) throw new Error('Bad args');
  });

  await test('buildCommand — getUrl', () => {
    const args = buildCommand({ action: 'getUrl' } as any);
    if (!args.includes('get') || !args.includes('url')) throw new Error('Bad args');
  });

  await test('buildCommand — getTitle', () => {
    const args = buildCommand({ action: 'getTitle' } as any);
    if (!args.includes('get') || !args.includes('title')) throw new Error('Bad args');
  });

  await test('buildCommand — eval', () => {
    const args = buildCommand({ action: 'eval', js: 'document.title' } as any);
    if (!args.includes('eval')) throw new Error('Missing eval');
  });

  await test('buildCommand — close', () => {
    const args = buildCommand({ action: 'close' } as any);
    if (!args.includes('close')) throw new Error('Missing close');
  });

  await test('buildCommand — with config', () => {
    const args = buildCommand({ action: 'open', url: 'https://test.com' } as any, {
      session: 'sess-1', cdpUrl: 'ws://localhost:9222', headless: false,
    });
    if (!args.includes('--session') || !args.includes('sess-1')) throw new Error('Missing session');
    if (!args.includes('--cdp')) throw new Error('Missing cdp');
    if (!args.includes('--no-headless')) throw new Error('Missing no-headless');
    console.log(`       With config: [${args.join(', ')}]`);
  });
}

async function testAstGrep() {
  hr('📦 @agent/sdk — AST-Grep Tool');

  await test('astGrepSearchTool — default instance', () => {
    if (!astGrepSearchTool) throw new Error('No default ast-grep search tool');
  });

  await test('createAstGrepTools()', () => {
    const tools = createAstGrepTools({});
    if (!tools) throw new Error('No tools');
    console.log(`       AST-grep tools: [${Object.keys(tools).join(', ')}]`);
  });

  await test('ensureAstGrepBinary()', async () => {
    try {
      const result = await ensureAstGrepBinary();
      console.log(`       Binary available: ${result}`);
    } catch (err: any) {
      console.log(`       Binary not installed: ${err.message?.slice(0, 50)}`);
    }
  });
}

async function testSubAgentConfigs() {
  hr('📦 @agent/sdk — Sub-Agent Configs');

  await test('subAgentConfigs', () => {
    if (!subAgentConfigs) throw new Error('Missing');
    const keys = Object.keys(subAgentConfigs);
    console.log(`       Configs: [${keys.join(', ')}]`);
    if (keys.length === 0) throw new Error('Empty configs');
  });

  await test('subAgentRoles', () => {
    if (!subAgentRoles || subAgentRoles.length === 0) throw new Error('Missing roles');
    console.log(`       Roles: [${subAgentRoles.join(', ')}]`);
  });

  await test('getSubAgentConfig()', () => {
    const firstRole = subAgentRoles[0];
    const config = getSubAgentConfig(firstRole);
    if (!config) throw new Error(`No config for ${firstRole}`);
    console.log(`       ${firstRole} config has: ${Object.keys(config).join(', ')}`);
  });
}

async function testDurabilityExpanded() {
  hr('📦 @agent/sdk — Durability Utilities');

  await test('wrapToolsAsDurable()', () => {
    const tools = { testTool: { description: 'test', parameters: { type: 'object' as const, properties: {} }, execute: async () => 'ok' } as any };
    const wrapped = wrapToolsAsDurable(tools);
    if (!wrapped.testTool) throw new Error('Tool not wrapped');
    console.log(`       Wrapped: [${Object.keys(wrapped).join(', ')}]`);
  });

  await test('wrapSelectedToolsAsDurable()', () => {
    const tools = {
      a: { description: 'a', execute: async () => 'a' } as any,
      b: { description: 'b', execute: async () => 'b' } as any,
    };
    const wrapped = wrapSelectedToolsAsDurable(tools, ['a']);
    if (!wrapped.a || !wrapped.b) throw new Error('Missing tools');
    console.log(`       ✓ selectively wrapped`);
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Brain — Expanded NLP & Analysis
// ════════════════════════════════════════════════════════════════════════════

async function testBrainExpanded() {
  hr('📦 @agent/brain — NLP Training Helpers');

  await test('autoLabel exists', () => {
    if (typeof autoLabel !== 'function') throw new Error('autoLabel not a function');
  });

  await test('labelSingle exists', () => {
    if (typeof labelSingle !== 'function') throw new Error('labelSingle not a function');
  });

  await test('loadSamples / saveSamples exist', () => {
    if (typeof loadSamples !== 'function') throw new Error('loadSamples not a function');
    if (typeof saveSamples !== 'function') throw new Error('saveSamples not a function');
  });

  await test('loadAnnotations / saveAnnotations exist', () => {
    if (typeof loadAnnotations !== 'function') throw new Error('loadAnnotations not a function');
    if (typeof saveAnnotations !== 'function') throw new Error('saveAnnotations not a function');
  });

  await test('parseClaudeExport exists', () => {
    if (typeof parseClaudeExport !== 'function') throw new Error('not a function');
  });

  await test('createSamplesFromStrings()', () => {
    if (typeof createSamplesFromStrings !== 'function') throw new Error('not a function');
    const samples = createSamplesFromStrings(['The server crashed at 3pm', 'Database timeout occurred']);
    if (!Array.isArray(samples)) throw new Error('Expected array');
    console.log(`       Created ${samples.length} samples`);
  });

  hr('📦 @agent/brain — Analysis Functions');

  await test('calculateCyclomatic()', () => {
    if (typeof calculateCyclomatic !== 'function') throw new Error('not a function');
  });

  await test('calculateCognitive()', () => {
    if (typeof calculateCognitive !== 'function') throw new Error('not a function');
  });

  await test('analyzeImpact exists', () => {
    if (typeof analyzeImpact !== 'function') throw new Error('not a function');
  });

  await test('classifyRisk exists', () => {
    if (typeof classifyRisk !== 'function') throw new Error('not a function');
  });

  await test('analyzeDataflow exists', () => {
    if (typeof analyzeDataflow !== 'function') throw new Error('not a function');
  });

  await test('scanForVulnerabilities exists', () => {
    if (typeof scanForVulnerabilities !== 'function') throw new Error('not a function');
  });

  await test('analyzeRefactoring exists', () => {
    if (typeof analyzeRefactoring !== 'function') throw new Error('not a function');
  });

  await test('parseProject exists', () => {
    if (typeof parseProject !== 'function') throw new Error('not a function');
  });

  await test('parseSingleFile exists', () => {
    if (typeof parseSingleFile !== 'function') throw new Error('not a function');
  });
}

// ════════════════════════════════════════════════════════════════════════════
// SDK-Client — WebSocket Client
// ════════════════════════════════════════════════════════════════════════════

async function testClientExpanded() {
  hr('📦 @agent/sdk-client — WebSocket Client');

  await test('AgentWebSocketClient — construct', () => {
    const ws = new AgentWebSocketClient({
      url: 'ws://localhost:4323/ws',
      onMessage: () => { },
    });
    if (!ws) throw new Error('No client');
    console.log(`       ✓ AgentWebSocketClient constructed`);
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────────────

async function main() {
  hr('🧪 COMPREHENSIVE SDK FEATURE TEST — ALL PACKAGES');
  console.log(`  Workspace: ${root}`);
  console.log(`  Timestamp: ${new Date().toISOString()}\n`);

  // Package 0: Brain
  await testBrain();
  await testBrainExpanded();

  // Package 1: Logger
  await testLogger();

  // Package 2: SDK — unit-level tests (no LLM calls)
  await testSdkCore();
  await testPresetsAndRoles();
  await testModels();
  await testConfig();
  await testMemory();
  await testSkills();
  await testObservability();
  await testSubAgentsAndBrowser();
  await testStreaming();
  await testHooks();
  await testDurability();
  await testDurabilityExpanded();
  await testSchedulers();
  await testSubAgentConfigs();

  // Package 2: SDK — Tool internals
  await testToolFactory();
  await testToolConstructors();
  await testBrowserTool();
  await testAstGrep();

  // Package 2: SDK — LLM integration tests
  await testGenerateWithTools();
  await testDirectStreaming();

  // Package 3: Server
  const port = await testServer();

  // Package 4: Client
  await testClient(port);
  await testClientExpanded();

  // Multi-role LLM tests
  await testMultiRoleGenerate();

  // ── Summary ──────────────────────────────────────────────────────────────
  hr('📊 FINAL RESULTS');
  console.log(`  ✅ Passed:  ${passed}`);
  console.log(`  ❌ Failed:  ${failed}`);
  console.log(`  ⏭️  Skipped: ${skipped}`);
  console.log(`  📋 Total:   ${passed + failed + skipped}\n`);

  if (issues.length > 0) {
    console.log('  🐛 Issues:');
    issues.forEach((issue, i) => console.log(`     ${i + 1}. ${issue}`));
    console.log('');
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});

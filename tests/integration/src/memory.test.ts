/**
 * @fileoverview Integration tests for the markdown-based memory system.
 *
 * Validates:
 * - MarkdownMemoryStore works end-to-end
 * - createMemoryTools produces usable tools
 * - createAgent includes memory tools by default
 * - Memory context loading via loadMemoryContext
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  MarkdownMemoryStore,
  loadMemoryContext,
  createAgent,
} from '@agntk/core';
import {
  createMemoryTools,
  createSearchSkillsTool,
  clearSkillsCache,
} from '@agntk/core/advanced';

// ============================================================================
// Helpers
// ============================================================================

let workspaceDir: string;
let globalDir: string;

async function createTempDirs() {
  workspaceDir = await mkdtemp(join(tmpdir(), 'agntk-integration-'));
  globalDir = await mkdtemp(join(tmpdir(), 'agntk-integration-global-'));
}

// ============================================================================
// Tests
// ============================================================================

describe('Memory', () => {
  beforeEach(async () => {
    await createTempDirs();
  });

  afterEach(async () => {
    await rm(workspaceDir, { recursive: true, force: true });
    await rm(globalDir, { recursive: true, force: true });
  });

  describe('MarkdownMemoryStore lifecycle', () => {
    it('should save and load memory', async () => {
      const store = new MarkdownMemoryStore({
        workspaceRoot: workspaceDir,
        globalDir: join(globalDir, '.agntk'),
      });

      await store.saveMemory('# Memory\n- TypeScript is typed');
      const result = await store.loadMemory();
      expect(result).toContain('TypeScript is typed');
    });

    it('should handle project fallback to CLAUDE.md', async () => {
      await writeFile(join(workspaceDir, 'CLAUDE.md'), '# Claude Config\nUse strict mode', 'utf-8');

      const store = new MarkdownMemoryStore({
        workspaceRoot: workspaceDir,
        globalDir: join(globalDir, '.agntk'),
      });

      const project = await store.loadProject();
      expect(project).toContain('Use strict mode');
    });

    it('should append decisions', async () => {
      const store = new MarkdownMemoryStore({
        workspaceRoot: workspaceDir,
        globalDir: join(globalDir, '.agntk'),
      });

      await store.appendDecision('## Decision 1');
      await store.appendDecision('## Decision 2');

      const decisions = await store.loadDecisions();
      expect(decisions).toContain('Decision 1');
      expect(decisions).toContain('Decision 2');
    });
  });

  describe('loadMemoryContext', () => {
    it('should return empty string when no files exist', async () => {
      const store = new MarkdownMemoryStore({
        workspaceRoot: workspaceDir,
        globalDir: join(globalDir, '.agntk'),
      });

      const result = await loadMemoryContext(store);
      expect(result).toBe('');
    });

    it('should format loaded files into sections', async () => {
      const store = new MarkdownMemoryStore({
        workspaceRoot: workspaceDir,
        globalDir: join(globalDir, '.agntk'),
      });

      // Write project and memory files
      await store.saveMemory('- Fact one\n- Fact two');
      await store.saveContext('Working on tests');

      const result = await loadMemoryContext(store);
      expect(result).toContain('# Persistent Memory');
      expect(result).toContain('## Memory');
      expect(result).toContain('## Current Context');
    });
  });

  describe('createMemoryTools', () => {
    it('should create 4 tools', () => {
      const store = new MarkdownMemoryStore({
        workspaceRoot: workspaceDir,
        globalDir: join(globalDir, '.agntk'),
      });

      const tools = createMemoryTools({ store });
      const toolNames = Object.keys(tools).sort();
      expect(toolNames).toEqual(['forget', 'recall', 'remember', 'update_context']);
    });

    it('remember tool should write to store (no-model path)', async () => {
      const store = new MarkdownMemoryStore({
        workspaceRoot: workspaceDir,
        globalDir: join(globalDir, '.agntk'),
      });

      const tools = createMemoryTools({ store });
      const resultStr = await tools.remember.execute(
        { text: 'Integration test fact' },
        { toolCallId: 'tc1', messages: [], abortSignal: undefined as unknown as AbortSignal },
      );
      const result = JSON.parse(resultStr as string);
      expect(result.success).toBe(true);

      const memory = await store.loadMemory();
      expect(memory).toContain('Integration test fact');
    });

    it('recall tool should find stored facts', async () => {
      const store = new MarkdownMemoryStore({
        workspaceRoot: workspaceDir,
        globalDir: join(globalDir, '.agntk'),
      });

      await store.saveMemory('# Memory\n\n## World Facts\n- TypeScript uses static typing\n\n## Decisions');

      const tools = createMemoryTools({ store });
      const resultStr = await tools.recall.execute(
        { query: 'TypeScript static' },
        { toolCallId: 'tc2', messages: [], abortSignal: undefined as unknown as AbortSignal },
      );
      const result = JSON.parse(resultStr as string);
      expect(result.success).toBe(true);
      expect(result.results.length).toBeGreaterThan(0);
    });
  });

  describe('createAgent (memory always on)', () => {
    it('should create agent with memory tools included', () => {
      const agent = createAgent({
        name: 'memory-test-agent',
        workspaceRoot: workspaceDir,
      });

      expect(agent).toBeDefined();
      expect(agent.name).toBe('memory-test-agent');
      expect(typeof agent.init).toBe('function');
      expect(typeof agent.stream).toBe('function');
      // Memory tools should be included automatically
      const toolNames = agent.getToolNames();
      expect(toolNames).toContain('remember');
      expect(toolNames).toContain('recall');
    });

    it('should have init method that resolves', async () => {
      const agent = createAgent({
        name: 'memory-init-agent',
        workspaceRoot: workspaceDir,
      });

      // init() should complete without error even when no files exist
      await expect(agent.init()).resolves.toBeUndefined();
    });
  });

  describe('createSearchSkillsTool', () => {
    it('should create a tool object', () => {
      const tool = createSearchSkillsTool({
        workspaceRoot: process.cwd(),
      });

      expect(tool).toBeDefined();
    });

    it('should clear skills cache without error', () => {
      expect(() => clearSkillsCache()).not.toThrow();
    });
  });
});

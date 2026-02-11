/**
 * @fileoverview Tests for MarkdownMemoryStore.
 *
 * Validates:
 * - load/save for all file types
 * - Auto-directory creation
 * - CLAUDE.md / AGENTS.md fallback for loadProject()
 * - Missing files return null
 * - appendDecision separator logic
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { MarkdownMemoryStore } from '../memory/store';

// ============================================================================
// Helpers
// ============================================================================

let projectDir: string;
let globalDir: string;

async function createTempDirs() {
  projectDir = await mkdtemp(join(tmpdir(), 'agntk-test-project-'));
  globalDir = await mkdtemp(join(tmpdir(), 'agntk-test-global-'));
}

function createStore(opts?: { projectDir?: string; globalDir?: string; workspaceRoot?: string }) {
  return new MarkdownMemoryStore({
    projectDir: opts?.projectDir ?? '.agntk',
    globalDir: opts?.globalDir ?? join(globalDir, '.agntk'),
    workspaceRoot: opts?.workspaceRoot ?? projectDir,
  });
}

// ============================================================================
// Tests
// ============================================================================

describe('MarkdownMemoryStore', () => {
  beforeEach(async () => {
    await createTempDirs();
  });

  afterEach(async () => {
    await rm(projectDir, { recursive: true, force: true });
    await rm(globalDir, { recursive: true, force: true });
  });

  // ── Load methods return null for missing files ──────────────

  describe('load methods (missing files)', () => {
    it('loadIdentity returns null when file does not exist', async () => {
      const store = createStore();
      expect(await store.loadIdentity()).toBeNull();
    });

    it('loadPreferences returns null when file does not exist', async () => {
      const store = createStore();
      expect(await store.loadPreferences()).toBeNull();
    });

    it('loadProject returns null when no project files exist', async () => {
      const store = createStore();
      expect(await store.loadProject()).toBeNull();
    });

    it('loadMemory returns null when file does not exist', async () => {
      const store = createStore();
      expect(await store.loadMemory()).toBeNull();
    });

    it('loadContext returns null when file does not exist', async () => {
      const store = createStore();
      expect(await store.loadContext()).toBeNull();
    });

    it('loadDecisions returns null when file does not exist', async () => {
      const store = createStore();
      expect(await store.loadDecisions()).toBeNull();
    });
  });

  // ── Save and load round-trip ──────────────────────────────

  describe('save and load', () => {
    it('saveContext creates directory and writes file, loadContext reads it back', async () => {
      const store = createStore();
      await store.saveContext('# Current Context\nWorking on tests');
      const result = await store.loadContext();
      expect(result).toBe('# Current Context\nWorking on tests');
    });

    it('saveMemory creates directory and writes file', async () => {
      const store = createStore();
      await store.saveMemory('# Memory\n- TypeScript is typed');
      const result = await store.loadMemory();
      expect(result).toBe('# Memory\n- TypeScript is typed');
    });

    it('savePreferences writes to global directory', async () => {
      const store = createStore();
      await store.savePreferences('# Preferences\n- Use Vitest');
      const result = await store.loadPreferences();
      expect(result).toBe('# Preferences\n- Use Vitest');
    });

    it('returns null for empty files', async () => {
      const store = createStore();
      const agntDir = join(projectDir, '.agntk');
      await mkdir(agntDir, { recursive: true });
      await writeFile(join(agntDir, 'memory.md'), '', 'utf-8');
      expect(await store.loadMemory()).toBeNull();
    });

    it('returns null for whitespace-only files', async () => {
      const store = createStore();
      const agntDir = join(projectDir, '.agntk');
      await mkdir(agntDir, { recursive: true });
      await writeFile(join(agntDir, 'memory.md'), '   \n  \n', 'utf-8');
      expect(await store.loadMemory()).toBeNull();
    });
  });

  // ── Directory auto-creation ───────────────────────────────

  describe('auto-directory creation', () => {
    it('creates .agntk/ directory on first save', async () => {
      const store = createStore();
      const agntDir = join(projectDir, '.agntk');
      expect(existsSync(agntDir)).toBe(false);
      await store.saveMemory('test content');
      expect(existsSync(agntDir)).toBe(true);
    });

    it('creates global directory on first savePreferences', async () => {
      const globalAgntDir = join(globalDir, '.agntk');
      const store = createStore();
      expect(existsSync(globalAgntDir)).toBe(false);
      await store.savePreferences('test prefs');
      expect(existsSync(globalAgntDir)).toBe(true);
    });
  });

  // ── loadProject fallback ──────────────────────────────────

  describe('loadProject fallback', () => {
    it('returns .agntk/project.md if it exists', async () => {
      const store = createStore();
      const agntDir = join(projectDir, '.agntk');
      await mkdir(agntDir, { recursive: true });
      await writeFile(join(agntDir, 'project.md'), '# Project\nMy project', 'utf-8');
      expect(await store.loadProject()).toBe('# Project\nMy project');
    });

    it('falls back to CLAUDE.md in workspace root', async () => {
      const store = createStore();
      await writeFile(join(projectDir, 'CLAUDE.md'), '# Claude Config', 'utf-8');
      expect(await store.loadProject()).toBe('# Claude Config');
    });

    it('falls back to AGENTS.md if CLAUDE.md does not exist', async () => {
      const store = createStore();
      await writeFile(join(projectDir, 'AGENTS.md'), '# Agents Config', 'utf-8');
      expect(await store.loadProject()).toBe('# Agents Config');
    });

    it('prefers .agntk/project.md over CLAUDE.md', async () => {
      const store = createStore();
      const agntDir = join(projectDir, '.agntk');
      await mkdir(agntDir, { recursive: true });
      await writeFile(join(agntDir, 'project.md'), 'project.md content', 'utf-8');
      await writeFile(join(projectDir, 'CLAUDE.md'), 'claude.md content', 'utf-8');
      expect(await store.loadProject()).toBe('project.md content');
    });

    it('prefers CLAUDE.md over AGENTS.md', async () => {
      const store = createStore();
      await writeFile(join(projectDir, 'CLAUDE.md'), 'claude content', 'utf-8');
      await writeFile(join(projectDir, 'AGENTS.md'), 'agents content', 'utf-8');
      expect(await store.loadProject()).toBe('claude content');
    });
  });

  // ── appendDecision ────────────────────────────────────────

  describe('appendDecision', () => {
    it('creates file with entry if file does not exist', async () => {
      const store = createStore();
      await store.appendDecision('## 2025-01-01 — Use Vitest');
      const result = await store.loadDecisions();
      expect(result).toBe('## 2025-01-01 — Use Vitest');
    });

    it('appends with separator if file already exists', async () => {
      const store = createStore();
      await store.appendDecision('## First decision');
      await store.appendDecision('## Second decision');
      const result = await store.loadDecisions();
      expect(result).toContain('## First decision');
      expect(result).toContain('## Second decision');
      expect(result).toContain('\n\n');
    });
  });

  // ── Path getters ──────────────────────────────────────────

  describe('path getters', () => {
    it('getProjectPath returns resolved path', () => {
      const store = createStore();
      expect(store.getProjectPath()).toContain('.agntk');
    });

    it('getGlobalPath returns resolved path', () => {
      const store = createStore();
      expect(store.getGlobalPath()).toContain('.agntk');
    });
  });
});

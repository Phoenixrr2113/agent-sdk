/**
 * @fileoverview Tests for markdown-based memory tools.
 *
 * Validates:
 * - Tool surface area (4 tools: remember, recall, update_context, forget)
 * - remember: stores text, updates memory.md, optionally logs decisions
 * - recall: keyword search across memory.md, decisions.md, context.md
 * - update_context: rewrites context.md
 * - forget: removes fact from memory.md
 * - Graceful error handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// Mocks
// ============================================================================

vi.mock('@agntk/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    time: vi.fn(() => vi.fn()),
  }),
}));

vi.mock('../memory/extraction', () => ({
  extractAndUpdateMemory: vi.fn(),
  forgetFromMemory: vi.fn(),
  generateDecisionEntry: vi.fn(),
  EMPTY_MEMORY_MD: '# Memory\n\n## World Facts\n\n## Decisions\n\n## Entity Knowledge\n\n## Preferences & Patterns\n',
}));

import { createMemoryTools, type MemoryToolsOptions } from '../memory/tools';
import { extractAndUpdateMemory, forgetFromMemory, generateDecisionEntry } from '../memory/extraction';
import type { MemoryStore } from '../memory/types';
import type { LanguageModel } from 'ai';

const mockExtract = extractAndUpdateMemory as ReturnType<typeof vi.fn>;
const mockForget = forgetFromMemory as ReturnType<typeof vi.fn>;
const mockDecisionEntry = generateDecisionEntry as ReturnType<typeof vi.fn>;

// ============================================================================
// Mock Store
// ============================================================================

function createMockStore(): MemoryStore & {
  _memory: string | null;
  _context: string | null;
  _decisions: string | null;
} {
  const store = {
    _memory: null as string | null,
    _context: null as string | null,
    _decisions: null as string | null,
    loadIdentity: vi.fn().mockResolvedValue(null),
    loadPreferences: vi.fn().mockResolvedValue(null),
    loadProject: vi.fn().mockResolvedValue(null),
    loadMemory: vi.fn(),
    loadContext: vi.fn(),
    loadDecisions: vi.fn(),
    saveContext: vi.fn(),
    saveMemory: vi.fn(),
    savePreferences: vi.fn().mockResolvedValue(undefined),
    appendDecision: vi.fn(),
  };

  store.loadMemory.mockImplementation(() => Promise.resolve(store._memory));
  store.loadContext.mockImplementation(() => Promise.resolve(store._context));
  store.loadDecisions.mockImplementation(() => Promise.resolve(store._decisions));
  store.saveContext.mockImplementation((content: string) => {
    store._context = content;
    return Promise.resolve();
  });
  store.saveMemory.mockImplementation((content: string) => {
    store._memory = content;
    return Promise.resolve();
  });
  store.appendDecision.mockImplementation((entry: string) => {
    store._decisions = (store._decisions ?? '') + (store._decisions ? '\n\n' : '') + entry;
    return Promise.resolve();
  });

  return store;
}

const mockModel = {} as LanguageModel;

const toolContext = {
  toolCallId: 'tc1',
  messages: [],
  abortSignal: undefined as unknown as AbortSignal,
};

// ============================================================================
// Tests
// ============================================================================

describe('createMemoryTools', () => {
  let store: ReturnType<typeof createMockStore>;

  beforeEach(() => {
    store = createMockStore();
    mockExtract.mockReset();
    mockForget.mockReset();
    mockDecisionEntry.mockReset();
  });

  describe('tool surface area', () => {
    it('returns 4 tools: remember, recall, update_context, forget', () => {
      const tools = createMemoryTools({ store });
      expect(Object.keys(tools).sort()).toEqual(['forget', 'recall', 'remember', 'update_context']);
    });

    it('each tool has execute function and description', () => {
      const tools = createMemoryTools({ store });
      for (const [name, t] of Object.entries(tools)) {
        expect(typeof t.execute).toBe('function');
      }
    });
  });

  describe('remember tool', () => {
    it('stores text directly when no model is provided', async () => {
      const tools = createMemoryTools({ store }); // no model
      const resultStr = await tools.remember.execute(
        { text: 'TypeScript is typed' },
        toolContext,
      );
      const result = JSON.parse(resultStr as string);
      expect(result.success).toBe(true);
      expect(store._memory).toContain('TypeScript is typed');
    });

    it('uses LLM extraction when model is provided', async () => {
      mockExtract.mockResolvedValue('# Memory\n\n## World Facts\n- TypeScript is typed');

      const tools = createMemoryTools({ store, model: mockModel });
      const resultStr = await tools.remember.execute(
        { text: 'TypeScript is typed' },
        toolContext,
      );
      const result = JSON.parse(resultStr as string);

      expect(result.success).toBe(true);
      expect(mockExtract).toHaveBeenCalledWith(null, 'TypeScript is typed', mockModel);
      expect(store._memory).toContain('TypeScript is typed');
    });

    it('logs to decisions.md when isDecision is true', async () => {
      mockExtract.mockResolvedValue('updated memory');
      mockDecisionEntry.mockResolvedValue('## 2025-01-01 — Use ESM');

      const tools = createMemoryTools({ store, model: mockModel });
      await tools.remember.execute(
        { text: 'We decided to use ESM', isDecision: true },
        toolContext,
      );

      expect(mockDecisionEntry).toHaveBeenCalledWith('We decided to use ESM', mockModel);
      expect(store.appendDecision).toHaveBeenCalledWith('## 2025-01-01 — Use ESM');
    });

    it('returns error when extraction fails', async () => {
      mockExtract.mockRejectedValue(new Error('LLM timeout'));

      const tools = createMemoryTools({ store, model: mockModel });
      const resultStr = await tools.remember.execute(
        { text: 'will fail' },
        toolContext,
      );
      const result = JSON.parse(resultStr as string);

      expect(result.success).toBe(false);
      expect(result.error).toContain('LLM timeout');
    });
  });

  describe('recall tool', () => {
    it('returns empty results when no memory exists', async () => {
      const tools = createMemoryTools({ store });
      const resultStr = await tools.recall.execute({ query: 'anything' }, toolContext);
      const result = JSON.parse(resultStr as string);

      expect(result.success).toBe(true);
      expect(result.results).toEqual([]);
    });

    it('searches memory.md content', async () => {
      store._memory = '# Memory\n\n## World Facts\n- TypeScript is typed\n- Python is interpreted';
      const tools = createMemoryTools({ store });
      const resultStr = await tools.recall.execute({ query: 'TypeScript' }, toolContext);
      const result = JSON.parse(resultStr as string);

      expect(result.success).toBe(true);
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.results[0].source).toBe('memory.md');
    });

    it('searches decisions.md content', async () => {
      store._decisions = '## 2025-01-01 — Use Vitest\n**Decision:** Use Vitest for testing';
      const tools = createMemoryTools({ store });
      const resultStr = await tools.recall.execute({ query: 'Vitest' }, toolContext);
      const result = JSON.parse(resultStr as string);

      expect(result.success).toBe(true);
      expect(result.results.some((r: { source: string }) => r.source === 'decisions.md')).toBe(true);
    });

    it('searches context.md content', async () => {
      store._context = '# Current Context\nWorking on memory system';
      const tools = createMemoryTools({ store });
      const resultStr = await tools.recall.execute({ query: 'memory' }, toolContext);
      const result = JSON.parse(resultStr as string);

      expect(result.success).toBe(true);
      expect(result.results.some((r: { source: string }) => r.source === 'context.md')).toBe(true);
    });

    it('ignores very short query words (<=2 chars)', async () => {
      store._memory = '# Memory\n\n- An is a word';
      const tools = createMemoryTools({ store });
      const resultStr = await tools.recall.execute({ query: 'an is' }, toolContext);
      const result = JSON.parse(resultStr as string);

      // "an" and "is" are both <=2 chars, so no matches
      expect(result.results).toEqual([]);
    });
  });

  describe('update_context tool', () => {
    it('saves context with timestamp', async () => {
      const tools = createMemoryTools({ store });
      const resultStr = await tools.update_context.execute(
        { summary: 'Implementing Phase 2 memory' },
        toolContext,
      );
      const result = JSON.parse(resultStr as string);

      expect(result.success).toBe(true);
      expect(store._context).toContain('# Current Context');
      expect(store._context).toContain('Implementing Phase 2 memory');
      expect(store._context).toContain('Last updated:');
    });
  });

  describe('forget tool', () => {
    it('returns error when no model is provided', async () => {
      const tools = createMemoryTools({ store }); // no model
      const resultStr = await tools.forget.execute({ fact: 'something' }, toolContext);
      const result = JSON.parse(resultStr as string);

      expect(result.success).toBe(false);
      expect(result.error).toContain('language model');
    });

    it('calls forgetFromMemory and saves result', async () => {
      store._memory = '# Memory\n- old fact\n- keep this';
      mockForget.mockResolvedValue('# Memory\n- keep this');

      const tools = createMemoryTools({ store, model: mockModel });
      const resultStr = await tools.forget.execute({ fact: 'old fact' }, toolContext);
      const result = JSON.parse(resultStr as string);

      expect(result.success).toBe(true);
      expect(mockForget).toHaveBeenCalledWith('# Memory\n- old fact\n- keep this', 'old fact', mockModel);
      expect(store._memory).toBe('# Memory\n- keep this');
    });

    it('returns error when forgetFromMemory throws', async () => {
      mockForget.mockRejectedValue(new Error('LLM error'));

      const tools = createMemoryTools({ store, model: mockModel });
      const resultStr = await tools.forget.execute({ fact: 'something' }, toolContext);
      const result = JSON.parse(resultStr as string);

      expect(result.success).toBe(false);
      expect(result.error).toContain('LLM error');
    });
  });
});

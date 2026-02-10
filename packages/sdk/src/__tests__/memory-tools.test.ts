/**
 * @fileoverview Integration tests for unified memory tools.
 *
 * Validates:
 * - Single remember tool writes to both Vectra and Graphology
 * - recall uses semantic search
 * - query_knowledge uses graph traversal
 * - forget removes from vector store
 * - No tool name collision (unified surface)
 * - Engine vs legacy store paths
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// Mocks
// ============================================================================

vi.mock('@agent/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    time: vi.fn(() => vi.fn()),
  }),
}));

vi.mock('../config', () => ({
  getConfig: () => ({ memory: {} }),
}));

vi.mock('../memory/extraction', () => ({
  extractFacts: vi.fn(),
}));

import { createMemoryTools, type MemoryToolsOptions } from '../memory/tools';
import { createMemoryEngine, type MemoryEngine, type MemoryGraphStore } from '../memory/engine';
import type { MemoryStore, MemorySearchResult, MemoryItem } from '../memory/vectra-store';
import { extractFacts } from '../memory/extraction';
import type { LanguageModel } from 'ai';

const mockExtractFacts = extractFacts as ReturnType<typeof vi.fn>;

// ============================================================================
// Test Helpers
// ============================================================================

function createMockVectorStore(): MemoryStore & {
  _items: Map<string, { text: string; metadata: Record<string, unknown> }>;
} {
  const items = new Map<string, { text: string; metadata: Record<string, unknown> }>();
  let idCounter = 0;

  return {
    _items: items,
    async remember(text: string, metadata?: Record<string, unknown>): Promise<string> {
      const id = `mem_${++idCounter}`;
      items.set(id, { text, metadata: metadata ?? {} });
      return id;
    },
    async recall(query: string, opts?: { topK?: number; threshold?: number }): Promise<MemorySearchResult[]> {
      const limit = opts?.topK ?? 5;
      return Array.from(items.entries())
        .filter(([, data]) => data.text.toLowerCase().includes(query.toLowerCase()))
        .slice(0, limit)
        .map(([id, data]) => ({
          item: { id, text: data.text, metadata: data.metadata, timestamp: new Date() } as MemoryItem,
          score: 0.9,
        }));
    },
    async forget(id: string): Promise<boolean> {
      return items.delete(id);
    },
    async forgetAll(): Promise<number> {
      const count = items.size;
      items.clear();
      return count;
    },
    async count(): Promise<number> {
      return items.size;
    },
    async close(): Promise<void> {},
  };
}

function createMockGraphStore(): MemoryGraphStore & {
  _episodes: Map<string, Record<string, unknown>>;
  _links: Array<{ episodeId: string; entityName: string }>;
} {
  const episodes = new Map<string, Record<string, unknown>>();
  const links: Array<{ episodeId: string; entityName: string }> = [];

  return {
    _episodes: episodes,
    _links: links,
    async upsertEpisode(episode) {
      episodes.set(episode.id, episode);
    },
    async linkEpisodeEntity(episodeId, entityName) {
      links.push({ episodeId, entityName });
    },
    async getEpisodesByQuery(query, limit) {
      const results: Array<Record<string, unknown>> = [];
      for (const [, ep] of episodes) {
        if (results.length >= limit) break;
        const summary = String(ep.summary ?? '').toLowerCase();
        const content = String(ep.content ?? '').toLowerCase();
        if (summary.includes(query.toLowerCase()) || content.includes(query.toLowerCase())) {
          results.push(ep);
        }
      }
      return results;
    },
    async upsertContradiction(contradiction) {
      // no-op for these tests
    },
  };
}

const mockModel = {} as LanguageModel;

// ============================================================================
// Tests: createMemoryTools
// ============================================================================

describe('createMemoryTools', () => {
  let vectorStore: ReturnType<typeof createMockVectorStore>;
  let graphStore: ReturnType<typeof createMockGraphStore>;
  let engine: MemoryEngine;

  beforeEach(() => {
    vectorStore = createMockVectorStore();
    graphStore = createMockGraphStore();
    mockExtractFacts.mockReset();
  });

  describe('validation', () => {
    it('should throw if neither engine nor store is provided', () => {
      expect(() => createMemoryTools({} as MemoryToolsOptions)).toThrow(
        'createMemoryTools requires either `engine` or `store`',
      );
    });
  });

  describe('tool surface area', () => {
    it('should return remember, recall, forget (no query_knowledge) with plain store', () => {
      const tools = createMemoryTools({ store: vectorStore });
      expect(Object.keys(tools).sort()).toEqual(['forget', 'recall', 'remember']);
    });

    it('should return remember, recall, forget, query_knowledge with engine', () => {
      engine = createMemoryEngine({ vectorStore, graphStore, extractionModel: mockModel });
      const tools = createMemoryTools({ engine });
      expect(Object.keys(tools).sort()).toEqual(['forget', 'query_knowledge', 'recall', 'remember']);
    });

    it('should not have colliding tool names (no duplicates)', () => {
      engine = createMemoryEngine({ vectorStore, graphStore, extractionModel: mockModel });
      const tools = createMemoryTools({ engine });
      const names = Object.keys(tools);
      expect(new Set(names).size).toBe(names.length);
    });
  });

  describe('remember tool (with engine)', () => {
    beforeEach(() => {
      engine = createMemoryEngine({ vectorStore, graphStore, extractionModel: mockModel });
    });

    it('should write to both vector and graph stores', async () => {
      mockExtractFacts.mockResolvedValue({
        facts: [
          {
            network: 'world_fact',
            fact: 'Node.js 22 is LTS',
            entities: [{ name: 'Node.js', type: 'Technology' }],
            relationships: [],
            confidence: 0.9,
          },
        ],
        rawText: 'Node.js 22 is LTS',
      });

      const tools = createMemoryTools({ engine });
      const resultStr = await tools.remember.execute(
        { text: 'Node.js 22 is LTS', tags: ['tech'], importance: 'high' },
        { toolCallId: 'tc1', messages: [], abortSignal: undefined as unknown as AbortSignal },
      );
      const result = JSON.parse(resultStr as string);

      expect(result.success).toBe(true);
      expect(result.operation).toBe('ADD');
      expect(result.factCount).toBe(1);
      // Both stores should have data
      expect(vectorStore._items.size).toBe(1);
      expect(graphStore._episodes.size).toBe(1);
    });

    it('should link entities in graph store', async () => {
      mockExtractFacts.mockResolvedValue({
        facts: [
          {
            network: 'entity_summary',
            fact: 'Bob manages Team Alpha',
            entities: [
              { name: 'Bob', type: 'Person' },
              { name: 'Team Alpha', type: 'Team' },
            ],
            relationships: [{ from: 'Bob', to: 'Team Alpha', type: 'MANAGES' }],
            confidence: 0.85,
          },
        ],
        rawText: 'Bob manages Team Alpha',
      });

      const tools = createMemoryTools({ engine });
      await tools.remember.execute(
        { text: 'Bob manages Team Alpha' },
        { toolCallId: 'tc2', messages: [], abortSignal: undefined as unknown as AbortSignal },
      );

      expect(graphStore._links).toHaveLength(2);
      expect(graphStore._links.map((l) => l.entityName).sort()).toEqual(['Bob', 'Team Alpha']);
    });
  });

  describe('remember tool (legacy store)', () => {
    it('should write to vector store only', async () => {
      const tools = createMemoryTools({ store: vectorStore });
      const resultStr = await tools.remember.execute(
        { text: 'Legacy memory item' },
        { toolCallId: 'tc3', messages: [], abortSignal: undefined as unknown as AbortSignal },
      );
      const result = JSON.parse(resultStr as string);

      expect(result.success).toBe(true);
      expect(result.operation).toBe('ADD');
      expect(vectorStore._items.size).toBe(1);
    });
  });

  describe('recall tool', () => {
    it('should return matching memories via engine', async () => {
      engine = createMemoryEngine({ vectorStore });
      await vectorStore.remember('TypeScript is great', {});
      await vectorStore.remember('Python is popular', {});

      const tools = createMemoryTools({ engine });
      const resultStr = await tools.recall.execute(
        { query: 'TypeScript', limit: 5 },
        { toolCallId: 'tc4', messages: [], abortSignal: undefined as unknown as AbortSignal },
      );
      const result = JSON.parse(resultStr as string);

      expect(result.success).toBe(true);
      expect(result.count).toBeGreaterThanOrEqual(1);
    });

    it('should return matching memories via legacy store', async () => {
      await vectorStore.remember('Vitest testing', {});

      const tools = createMemoryTools({ store: vectorStore });
      const resultStr = await tools.recall.execute(
        { query: 'Vitest', limit: 5 },
        { toolCallId: 'tc5', messages: [], abortSignal: undefined as unknown as AbortSignal },
      );
      const result = JSON.parse(resultStr as string);

      expect(result.success).toBe(true);
      expect(result.count).toBe(1);
    });
  });

  describe('forget tool', () => {
    it('should remove memory from vector store', async () => {
      const id = await vectorStore.remember('Delete me', {});
      expect(vectorStore._items.size).toBe(1);

      engine = createMemoryEngine({ vectorStore });
      const tools = createMemoryTools({ engine });
      const resultStr = await tools.forget.execute(
        { id },
        { toolCallId: 'tc6', messages: [], abortSignal: undefined as unknown as AbortSignal },
      );
      const result = JSON.parse(resultStr as string);

      expect(result.success).toBe(true);
      expect(vectorStore._items.size).toBe(0);
    });

    it('should return false for non-existent memory', async () => {
      engine = createMemoryEngine({ vectorStore });
      const tools = createMemoryTools({ engine });
      const resultStr = await tools.forget.execute(
        { id: 'nonexistent' },
        { toolCallId: 'tc7', messages: [], abortSignal: undefined as unknown as AbortSignal },
      );
      const result = JSON.parse(resultStr as string);

      expect(result.success).toBe(false);
    });
  });

  describe('query_knowledge tool', () => {
    it('should search episodes in graph store', async () => {
      engine = createMemoryEngine({ vectorStore, graphStore, extractionModel: mockModel });

      mockExtractFacts.mockResolvedValue({
        facts: [
          {
            network: 'experience',
            fact: 'Deployed v2.0 to production',
            entities: [],
            relationships: [],
            confidence: 0.9,
          },
        ],
        rawText: 'Deployed v2.0 to production',
      });

      await engine.remember('Deployed v2.0 to production');

      const tools = createMemoryTools({ engine });
      const resultStr = await tools.query_knowledge!.execute(
        { query: 'deployed', limit: 10 },
        { toolCallId: 'tc8', messages: [], abortSignal: undefined as unknown as AbortSignal },
      );
      const result = JSON.parse(resultStr as string);

      expect(result.success).toBe(true);
      expect(result.count).toBe(1);
    });

    it('should not exist when using legacy store', () => {
      const tools = createMemoryTools({ store: vectorStore });
      expect(tools).not.toHaveProperty('query_knowledge');
    });
  });
});

// ============================================================================
// Tests: No tool collision in createAgent
// ============================================================================

describe('no tool collision in createAgent', () => {
  it('should not have duplicate tool names when memoryEngine is provided', async () => {
    // This is a conceptual test — when brain tools are removed and unified memory
    // tools are added, there should be no `remember` or `recall` defined twice.
    const vectorStore = createMockVectorStore();
    const engine = createMemoryEngine({ vectorStore });
    const tools = createMemoryTools({ engine });

    // Verify each tool name appears exactly once
    const toolNames = Object.keys(tools);
    const uniqueNames = new Set(toolNames);
    expect(uniqueNames.size).toBe(toolNames.length);

    // Verify the expected names
    expect(toolNames).toContain('remember');
    expect(toolNames).toContain('recall');
    expect(toolNames).toContain('forget');
    // query_knowledge only with graph store
    expect(toolNames).not.toContain('queryKnowledge'); // old brain tool name
    expect(toolNames).not.toContain('extractEntities'); // old brain tool name
  });
});

/**
 * @fileoverview Tests for unified memory engine — remember/recall/queryKnowledge/forget lifecycle.
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

vi.mock('../config', () => ({
  getConfig: () => ({ memory: {} }),
}));

// Mock the extraction module — we don't want to call an LLM in tests
vi.mock('../memory/extraction', () => ({
  extractFacts: vi.fn(),
}));

import { createMemoryEngine, type MemoryEngine, type MemoryGraphStore, type ContradictionDetectorPort } from '../memory/engine';
import type { MemoryStore, MemorySearchResult, MemoryItem } from '../memory/vectra-store';
import { extractFacts } from '../memory/extraction';
import type { LanguageModel } from 'ai';

const mockExtractFacts = extractFacts as ReturnType<typeof vi.fn>;

// ============================================================================
// Test Helpers
// ============================================================================

function createMockVectorStore(): MemoryStore & { _items: Map<string, { text: string; metadata: Record<string, unknown> }> } {
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
  _contradictions: Map<string, Record<string, unknown>>;
  _links: Array<{ episodeId: string; entityName: string }>;
} {
  const episodes = new Map<string, Record<string, unknown>>();
  const contradictions = new Map<string, Record<string, unknown>>();
  const links: Array<{ episodeId: string; entityName: string }> = [];

  return {
    _episodes: episodes,
    _contradictions: contradictions,
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
      contradictions.set(contradiction.id, contradiction);
    },
  };
}

function createMockContradictionDetector(): ContradictionDetectorPort {
  return {
    detect(statementA, statementB, metadataA, metadataB) {
      // Simple: if statements are similar but contain different numbers, it's a contradiction
      const numsA = statementA.match(/\d+/);
      const numsB = statementB.match(/\d+/);
      if (numsA && numsB && numsA[0] !== numsB[0]) {
        const wordsA = new Set(statementA.toLowerCase().split(/\s+/));
        const wordsB = new Set(statementB.toLowerCase().split(/\s+/));
        const intersection = [...wordsA].filter((x) => wordsB.has(x));
        const similarity = intersection.length / Math.max(wordsA.size, wordsB.size);
        if (similarity > 0.5) {
          return {
            id: `conflict-${Date.now()}`,
            factA: { id: metadataA?.id ?? 'a', statement: statementA, source: metadataA?.source ?? 'a', timestamp: metadataA?.timestamp ?? '' },
            factB: { id: metadataB?.id ?? 'b', statement: statementB, source: metadataB?.source ?? 'b', timestamp: metadataB?.timestamp ?? '' },
            detectedAt: new Date().toISOString(),
          };
        }
      }
      return null;
    },
  };
}

const mockModel = {} as LanguageModel;

// ============================================================================
// Tests
// ============================================================================

describe('createMemoryEngine', () => {
  let vectorStore: ReturnType<typeof createMockVectorStore>;
  let graphStore: ReturnType<typeof createMockGraphStore>;
  let engine: MemoryEngine;

  beforeEach(() => {
    vectorStore = createMockVectorStore();
    graphStore = createMockGraphStore();
    mockExtractFacts.mockReset();
  });

  describe('remember (without extraction model)', () => {
    beforeEach(() => {
      engine = createMemoryEngine({ vectorStore });
    });

    it('should store raw text in vector store', async () => {
      const result = await engine.remember('The sky is blue');
      expect(result.id).toBeTruthy();
      expect(result.operation).toBe('ADD');
      expect(result.facts).toHaveLength(0);
      expect(vectorStore._items.size).toBe(1);
    });

    it('should pass metadata to vector store', async () => {
      await engine.remember('Test', { tags: ['test'], importance: 'high' });
      const stored = Array.from(vectorStore._items.values())[0];
      expect(stored.metadata.tags).toEqual(['test']);
      expect(stored.metadata.importance).toBe('high');
    });
  });

  describe('remember (with extraction model)', () => {
    beforeEach(() => {
      engine = createMemoryEngine({ vectorStore, graphStore, extractionModel: mockModel });
    });

    it('should extract facts and write to both stores', async () => {
      mockExtractFacts.mockResolvedValue({
        facts: [
          {
            network: 'world_fact',
            fact: 'TypeScript 5.3 supports import attributes',
            entities: [{ name: 'TypeScript', type: 'Technology' }],
            relationships: [],
            confidence: 0.9,
          },
        ],
        rawText: 'TypeScript 5.3 supports import attributes',
      });

      const result = await engine.remember('TypeScript 5.3 supports import attributes');
      expect(result.operation).toBe('ADD');
      expect(result.facts).toHaveLength(1);
      expect(result.facts[0].network).toBe('world_fact');

      // Vector store should have the memory
      expect(vectorStore._items.size).toBe(1);

      // Graph store should have the episode
      expect(graphStore._episodes.size).toBe(1);
    });

    it('should link entities in graph store', async () => {
      mockExtractFacts.mockResolvedValue({
        facts: [
          {
            network: 'entity_summary',
            fact: 'Alice works on Project Atlas',
            entities: [
              { name: 'Alice', type: 'Person' },
              { name: 'Project Atlas', type: 'Project' },
            ],
            relationships: [{ from: 'Alice', to: 'Project Atlas', type: 'WORKS_ON' }],
            confidence: 0.85,
          },
        ],
        rawText: 'Alice works on Project Atlas',
      });

      await engine.remember('Alice works on Project Atlas');

      // Should have linked both entities
      expect(graphStore._links).toHaveLength(2);
      expect(graphStore._links.map((l) => l.entityName).sort()).toEqual(['Alice', 'Project Atlas']);
    });

    it('should handle extraction failure gracefully', async () => {
      mockExtractFacts.mockRejectedValue(new Error('LLM timeout'));

      const result = await engine.remember('Some text');
      // Should still succeed — falls back to raw text storage
      expect(result.id).toBeTruthy();
      expect(result.operation).toBe('ADD');
      expect(result.facts).toHaveLength(0);
      expect(vectorStore._items.size).toBe(1);
    });

    it('should return all 4 network types when extracted', async () => {
      mockExtractFacts.mockResolvedValue({
        facts: [
          { network: 'world_fact', fact: 'Fact A', entities: [], relationships: [], confidence: 0.9 },
          { network: 'experience', fact: 'Fact B', entities: [], relationships: [], confidence: 0.8 },
          { network: 'entity_summary', fact: 'Fact C', entities: [], relationships: [], confidence: 0.85 },
          { network: 'belief', fact: 'Fact D', entities: [], relationships: [], confidence: 0.7 },
        ],
        rawText: 'mixed content',
      });

      const result = await engine.remember('mixed content');
      expect(result.facts).toHaveLength(4);
      const networks = result.facts.map((f) => f.network);
      expect(networks).toContain('world_fact');
      expect(networks).toContain('experience');
      expect(networks).toContain('entity_summary');
      expect(networks).toContain('belief');
    });
  });

  describe('remember (with contradiction detection)', () => {
    let detector: ReturnType<typeof createMockContradictionDetector>;

    beforeEach(() => {
      detector = createMockContradictionDetector();
      engine = createMemoryEngine({
        vectorStore,
        graphStore,
        extractionModel: mockModel,
        contradictionDetector: detector,
      });
    });

    it('should detect contradiction and return UPDATE operation', async () => {
      // First, store an existing fact
      await vectorStore.remember('The timeout is 30 seconds', {});

      mockExtractFacts.mockResolvedValue({
        facts: [
          { network: 'world_fact', fact: 'The timeout is 60 seconds', entities: [], relationships: [], confidence: 0.9 },
        ],
        rawText: 'The timeout is 60 seconds',
      });

      const result = await engine.remember('The timeout is 60 seconds');
      expect(result.operation).toBe('UPDATE');
      expect(result.contradiction).toBeTruthy();
      expect(result.contradiction!.existingFact).toContain('30 seconds');
      expect(result.contradiction!.newFact).toContain('60 seconds');
    });

    it('should store contradiction in graph store', async () => {
      await vectorStore.remember('The timeout is 30 seconds', {});

      mockExtractFacts.mockResolvedValue({
        facts: [
          { network: 'world_fact', fact: 'The timeout is 60 seconds', entities: [], relationships: [], confidence: 0.9 },
        ],
        rawText: 'The timeout is 60 seconds',
      });

      await engine.remember('The timeout is 60 seconds');
      expect(graphStore._contradictions.size).toBe(1);
    });

    it('should not detect contradiction for unrelated facts', async () => {
      await vectorStore.remember('The sky is blue', {});

      mockExtractFacts.mockResolvedValue({
        facts: [
          { network: 'world_fact', fact: 'TypeScript is great', entities: [], relationships: [], confidence: 0.9 },
        ],
        rawText: 'TypeScript is great',
      });

      const result = await engine.remember('TypeScript is great');
      expect(result.operation).toBe('ADD');
      expect(result.contradiction).toBeUndefined();
    });
  });

  describe('recall', () => {
    beforeEach(() => {
      engine = createMemoryEngine({ vectorStore });
    });

    it('should delegate to vector store', async () => {
      await vectorStore.remember('Test memory', {});
      const results = await engine.recall('Test');
      expect(results).toHaveLength(1);
      expect(results[0].item.text).toBe('Test memory');
    });

    it('should pass options through', async () => {
      await vectorStore.remember('A', {});
      await vectorStore.remember('B', {});
      await vectorStore.remember('C', {});

      const results = await engine.recall('query', { topK: 2 });
      expect(results).toHaveLength(2);
    });
  });

  describe('queryKnowledge', () => {
    it('should return empty without graph store', async () => {
      engine = createMemoryEngine({ vectorStore });
      const results = await engine.queryKnowledge('test');
      expect(results).toHaveLength(0);
    });

    it('should search episodes in graph store', async () => {
      engine = createMemoryEngine({ vectorStore, graphStore, extractionModel: mockModel });

      mockExtractFacts.mockResolvedValue({
        facts: [
          { network: 'experience', fact: 'Deployed new feature successfully', entities: [], relationships: [], confidence: 0.9 },
        ],
        rawText: 'Deployed new feature successfully',
      });

      await engine.remember('Deployed new feature successfully');

      const results = await engine.queryKnowledge('deployed');
      expect(results).toHaveLength(1);
    });
  });

  describe('forget', () => {
    beforeEach(() => {
      engine = createMemoryEngine({ vectorStore });
    });

    it('should delete from vector store', async () => {
      const id = await vectorStore.remember('Delete me', {});
      expect(vectorStore._items.size).toBe(1);
      const success = await engine.forget(id);
      expect(success).toBe(true);
      expect(vectorStore._items.size).toBe(0);
    });

    it('should return false for non-existent id', async () => {
      const success = await engine.forget('nonexistent');
      expect(success).toBe(false);
    });
  });

  describe('count', () => {
    beforeEach(() => {
      engine = createMemoryEngine({ vectorStore });
    });

    it('should return vector store count', async () => {
      expect(await engine.count()).toBe(0);
      await vectorStore.remember('A', {});
      await vectorStore.remember('B', {});
      expect(await engine.count()).toBe(2);
    });
  });

  describe('close', () => {
    it('should resolve without error', async () => {
      engine = createMemoryEngine({ vectorStore });
      await expect(engine.close()).resolves.toBeUndefined();
    });
  });
});

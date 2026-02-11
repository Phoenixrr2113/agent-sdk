/**
 * @fileoverview Tests for Vectra memory store — remember/recall/forget lifecycle.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Track mock items for the fake Vectra index
let mockItems: Array<{
  id: string;
  vector: number[];
  metadata: Record<string, unknown>;
}> = [];

vi.mock('vectra', () => {
  class MockLocalIndex {
    constructor(_path: string) {}
    async isIndexCreated() { return true; }
    async createIndex() {}
    async insertItem(item: { id: string; vector: number[]; metadata: Record<string, unknown> }) {
      mockItems.push(item);
    }
    async queryItems(vector: number[], topK: number) {
      // Return all items sorted by a fake score (dot product sim)
      return mockItems
        .slice(0, topK)
        .map((item) => ({
          item: { id: item.id, metadata: item.metadata },
          score: 0.9,
        }));
    }
    async listItems() {
      return mockItems.map((item) => ({
        id: item.id,
        metadata: item.metadata,
      }));
    }
    async deleteItem(id: string) {
      const idx = mockItems.findIndex((i) => i.id === id);
      if (idx === -1) throw new Error('Item not found');
      mockItems.splice(idx, 1);
    }
  }

  return { LocalIndex: MockLocalIndex };
});

vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@agntk/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('../config', () => ({
  getConfig: () => ({ memory: {} }),
}));

// Mock the fetch-based embedding function by stubbing global fetch
const mockEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5];

const originalFetch = globalThis.fetch;
beforeEach(() => {
  mockItems = [];
  process.env['OPENAI_API_KEY'] = 'test-key';

  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: [{ embedding: mockEmbedding }] }),
  }) as unknown as typeof fetch;
});

import { createMemoryStore, type MemoryStore } from '../memory/vectra-store';

describe('createMemoryStore', () => {
  let store: MemoryStore;

  beforeEach(async () => {
    store = await createMemoryStore({
      path: '/tmp/test-vectra',
      topK: 10,
      similarityThreshold: 0.5,
    });
  });

  describe('remember', () => {
    it('should store a memory and return an id', async () => {
      const id = await store.remember('The sky is blue');
      expect(id).toBeTruthy();
      expect(typeof id).toBe('string');
      expect(id.startsWith('mem_')).toBe(true);
    });

    it('should call embedding API with the text', async () => {
      await store.remember('Hello world');
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('embeddings'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('Hello world'),
        }),
      );
    });

    it('should store metadata alongside text', async () => {
      await store.remember('Project deadline', { project: 'sdk', urgent: true });
      expect(mockItems).toHaveLength(1);
      expect(mockItems[0].metadata).toMatchObject({
        text: 'Project deadline',
        project: 'sdk',
        urgent: true,
      });
    });
  });

  describe('recall', () => {
    it('should return matching results', async () => {
      await store.remember('TypeScript is great');
      const results = await store.recall('TypeScript');
      expect(results).toHaveLength(1);
      expect(results[0].item.text).toBe('TypeScript is great');
      expect(results[0].score).toBeGreaterThan(0);
    });

    it('should filter by similarity threshold', async () => {
      // Our mock always returns score 0.9, so with threshold 0.95 nothing matches
      await store.remember('Something');
      const results = await store.recall('query', { threshold: 0.95 });
      expect(results).toHaveLength(0);
    });

    it('should respect topK parameter', async () => {
      await store.remember('Memory 1');
      await store.remember('Memory 2');
      await store.remember('Memory 3');

      const results = await store.recall('query', { topK: 2 });
      expect(results.length).toBeLessThanOrEqual(2);
    });
  });

  describe('forget', () => {
    it('should delete an item by id and return true', async () => {
      const id = await store.remember('Delete me');
      const deleted = await store.forget(id);
      expect(deleted).toBe(true);
      expect(mockItems).toHaveLength(0);
    });

    it('should return false for non-existent id', async () => {
      const deleted = await store.forget('nonexistent');
      expect(deleted).toBe(false);
    });
  });

  describe('forgetAll', () => {
    it('should delete all items when no filter provided', async () => {
      await store.remember('A');
      await store.remember('B');
      await store.remember('C');
      expect(mockItems).toHaveLength(3);

      const deleted = await store.forgetAll();
      expect(deleted).toBe(3);
      expect(mockItems).toHaveLength(0);
    });

    it('should only delete items matching the filter', async () => {
      await store.remember('Keep', { type: 'keep' });
      await store.remember('Remove', { type: 'remove' });

      const deleted = await store.forgetAll(
        (item) => item.metadata?.type === 'remove',
      );
      expect(deleted).toBe(1);
      expect(mockItems).toHaveLength(1);
      expect(mockItems[0].metadata.text).toBe('Keep');
    });
  });

  describe('count', () => {
    it('should return 0 for empty store', async () => {
      expect(await store.count()).toBe(0);
    });

    it('should return correct count after inserts', async () => {
      await store.remember('A');
      await store.remember('B');
      expect(await store.count()).toBe(2);
    });
  });

  describe('close', () => {
    it('should resolve without error', async () => {
      await expect(store.close()).resolves.toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('should throw if OPENAI_API_KEY is missing', async () => {
      delete process.env['OPENAI_API_KEY'];
      await expect(store.remember('test')).rejects.toThrow('OPENAI_API_KEY');
    });

    it('should throw on embedding API failure', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Bad Request',
      }) as unknown as typeof fetch;

      await expect(store.remember('test')).rejects.toThrow('Embedding failed');
    });
  });
});

/**
 * @fileoverview Integration tests for memory engine and search skills.
 * Uses in-memory adapter for MemoryStore to test engine lifecycle.
 */

import { describe, it, expect } from 'vitest';
import {
  createMemoryEngine,
  createSearchSkillsTool,
  clearSkillsCache,
} from '@agntk/core';
import type { MemoryStore, MemorySearchResult } from '@agntk/core';

/**
 * In-memory adapter satisfying the MemoryStore interface.
 */
function createInMemoryStore(): MemoryStore {
  const items = new Map<string, { text: string; metadata: Record<string, unknown> }>();

  return {
    async remember(text: string, metadata?: Record<string, unknown>): Promise<string> {
      const writeId = (metadata?.writeId as string) ?? `mem-${items.size + 1}`;
      items.set(writeId, { text, metadata: metadata ?? {} });
      return writeId;
    },
    async recall(query: string | unknown, limitOrOpts?: number | { topK?: number; threshold?: number }): Promise<MemorySearchResult[]> {
      const q = typeof query === 'string' ? query : '';
      const limit = typeof limitOrOpts === 'number' ? limitOrOpts : (limitOrOpts as any)?.topK ?? 10;
      const results: MemorySearchResult[] = [];
      for (const [id, item] of items) {
        if (item.text.toLowerCase().includes(q.toLowerCase())) {
          results.push({
            text: item.text,
            score: 1.0,
            metadata: { ...item.metadata, id },
          });
        }
      }
      return results.slice(0, limit);
    },
    async forget(id: string): Promise<boolean> {
      return items.delete(id);
    },
    async forgetAll(): Promise<void> {
      items.clear();
    },
    async count(): Promise<number> {
      return items.size;
    },
    async close(): Promise<void> {
      items.clear();
    },
  };
}

describe('Memory', () => {
  describe('createMemoryEngine lifecycle', () => {
    it('should remember and recall', async () => {
      const store = createInMemoryStore();
      const engine = createMemoryEngine({ vectorStore: store });

      // Remember
      const writeResult = await engine.remember('TypeScript is a typed superset of JavaScript');
      expect(writeResult).toBeDefined();
      expect(writeResult.id).toBeDefined();
      expect(writeResult.operation).toBeDefined();

      // Recall
      const results = await engine.recall('TypeScript');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].text).toContain('TypeScript');
    });

    it('should remember multiple facts', async () => {
      const store = createInMemoryStore();
      const engine = createMemoryEngine({ vectorStore: store });

      const r1 = await engine.remember('TypeScript was released in 2012');
      const r2 = await engine.remember('Rust focuses on memory safety');

      expect(r1.id).not.toBe(r2.id);
    });

    it('should query knowledge (returns empty without graph store)', async () => {
      const store = createInMemoryStore();
      const engine = createMemoryEngine({ vectorStore: store });

      const results = await engine.queryKnowledge('TypeScript');
      expect(Array.isArray(results)).toBe(true);
      expect(results).toHaveLength(0); // No graph store configured
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

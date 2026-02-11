/**
 * @agntk/core - Memory Tools
 *
 * Unified memory tools: remember, recall, forget, query_knowledge.
 * Uses the unified MemoryEngine for LLM extraction + parallel writes.
 */

import { tool } from 'ai';
import { z } from 'zod';
import { createLogger } from '@agntk/logger';
import type { MemoryEngine } from './engine';
import type { MemoryStore } from './vectra-store';

const log = createLogger('@agntk/core:memory');

// ============================================================================
// Types
// ============================================================================

export interface MemoryToolsOptions {
  /** Unified memory engine (preferred — supports extraction + graph) */
  engine?: MemoryEngine;

  /** Legacy: plain vector store (used when engine is not provided) */
  store?: MemoryStore;

  /** Default number of results to return */
  defaultTopK?: number;

  /** Default similarity threshold */
  defaultThreshold?: number;
}

// ============================================================================
// Tool Factory
// ============================================================================

/**
 * Create memory tools for an agent.
 *
 * @example
 * ```typescript
 * // With unified engine (recommended)
 * const engine = createMemoryEngine({ vectorStore, graphStore, extractionModel });
 * const tools = createMemoryTools({ engine });
 *
 * // Legacy: with plain vector store
 * const store = await createMemoryStore({ path: './.memory' });
 * const tools = createMemoryTools({ store });
 * ```
 */
export function createMemoryTools(options: MemoryToolsOptions) {
  const { engine, store, defaultTopK = 5, defaultThreshold = 0.7 } = options;

  if (!engine && !store) {
    throw new Error('createMemoryTools requires either `engine` or `store`');
  }

  const remember = tool({
    description: `Store information in long-term memory. Extracts structured facts, detects contradictions, and writes to both semantic and structural stores.`,
    inputSchema: z.object({
      text: z.string().min(1).max(10000).describe('Information to remember'),
      tags: z.array(z.string()).optional().describe('Optional tags for categorization'),
      importance: z.enum(['low', 'medium', 'high']).optional().describe('Importance level'),
    }),
    execute: async ({ text, tags, importance }) => {
      log.debug('remember() called', { textLength: text.length, tags, importance });
      try {
        const done = log.time('remember');

        if (engine) {
          const result = await engine.remember(text, { tags, importance });
          done();
          log.info('Memory stored (unified)', { id: result.id, facts: result.facts.length, operation: result.operation });
          return JSON.stringify({
            success: true,
            id: result.id,
            operation: result.operation,
            factCount: result.facts.length,
            networks: [...new Set(result.facts.map((f) => f.network))],
            contradiction: result.contradiction
              ? { id: result.contradiction.id, existingFact: result.contradiction.existingFact }
              : undefined,
            message: result.contradiction
              ? `Memory stored (UPDATE — contradiction detected with existing fact)`
              : `Memory stored (${result.facts.length} facts extracted)`,
          });
        }

        // Legacy path: plain vector store
        const id = await store!.remember(text, { tags, importance });
        done();
        log.info('Memory stored (legacy)', { id });
        return JSON.stringify({ success: true, id, operation: 'ADD', message: 'Memory stored' });
      } catch (error) {
        log.error('remember() failed', { error: error instanceof Error ? error.message : 'Unknown' });
        return JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Failed' });
      }
    },
  });

  const recall = tool({
    description: `Search long-term memory for relevant information by semantic similarity.`,
    inputSchema: z.object({
      query: z.string().min(1).max(1000).describe('What to search for'),
      limit: z.number().min(1).max(20).optional().describe('Max results (default 5)'),
      threshold: z.number().min(0).max(1).optional().describe('Min similarity (default 0.7)'),
    }),
    execute: async ({ query, limit, threshold }) => {
      log.debug('recall() called', { query: query.slice(0, 50), limit, threshold });
      try {
        const done = log.time('recall');
        const recallOpts = {
          topK: limit ?? defaultTopK,
          threshold: threshold ?? defaultThreshold,
        };
        const results = engine
          ? await engine.recall(query, recallOpts)
          : await store!.recall(query, recallOpts);
        done();
        log.info('Memory recalled', { query: query.slice(0, 30), resultsCount: results.length });
        return JSON.stringify({
          success: true,
          memories: results.map((r) => ({
            id: r.item.id,
            text: r.item.text,
            score: Math.round(r.score * 100) / 100,
            tags: r.item.metadata?.tags,
            timestamp: r.item.timestamp,
          })),
          count: results.length,
        });
      } catch (error) {
        log.error('recall() failed', { error: error instanceof Error ? error.message : 'Unknown' });
        return JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Failed' });
      }
    },
  });

  const forget = tool({
    description: `Remove a specific memory from long-term storage.`,
    inputSchema: z.object({
      id: z.string().describe('Memory ID to delete'),
    }),
    execute: async ({ id }) => {
      log.debug('forget() called', { id });
      try {
        const success = engine ? await engine.forget(id) : await store!.forget(id);
        log.info('Memory deleted', { id, success });
        return JSON.stringify({ success, message: success ? 'Memory deleted' : 'Not found' });
      } catch (error) {
        log.error('forget() failed', { id, error: error instanceof Error ? error.message : 'Unknown' });
        return JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Failed' });
      }
    },
  });

  // Only expose query_knowledge when engine with graph store is available
  const queryKnowledge = engine
    ? tool({
        description: `Query the knowledge graph for structural relationships and episodes. Use this for questions about entities, relationships, and past experiences rather than raw text similarity.`,
        inputSchema: z.object({
          query: z.string().min(1).max(1000).describe('What to search for in the knowledge graph'),
          limit: z.number().min(1).max(50).optional().describe('Max results (default 10)'),
        }),
        execute: async ({ query, limit }) => {
          log.debug('queryKnowledge() called', { query: query.slice(0, 50) });
          try {
            const results = await engine.queryKnowledge(query, limit ?? 10);
            return JSON.stringify({
              success: true,
              results,
              count: results.length,
            });
          } catch (error) {
            log.error('queryKnowledge() failed', { error: error instanceof Error ? error.message : 'Unknown' });
            return JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Failed' });
          }
        },
      })
    : undefined;

  return {
    remember,
    recall,
    forget,
    ...(queryKnowledge ? { query_knowledge: queryKnowledge } : {}),
  };
}

// ============================================================================
// Re-exports
// ============================================================================

export { createMemoryStore, type MemoryStore, type MemoryItem, type MemorySearchResult } from './vectra-store';
export { createMemoryEngine, type MemoryEngine, type MemoryEngineConfig, type MemoryWriteResult } from './engine';
export { type MemoryNetworkType, type MemoryOperation, type ExtractedFact, type ExtractionResult } from './extraction';

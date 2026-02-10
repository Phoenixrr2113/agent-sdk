/**
 * @agent/sdk - Unified Memory Engine
 *
 * Single write path: remember() → LLM extraction → parallel writes to Vectra + Graph.
 * Implements Mem0 ADD/UPDATE/DELETE/NOOP pattern with Hindsight 4-network taxonomy.
 *
 * Architecture:
 * - VectorStore: Semantic similarity search (Vectra)
 * - GraphStore: Structural relationships (Graphology via QueryPort)
 * - ExtractionModel: LLM-powered fact extraction
 * - ContradictionDetector: Write-time conflict detection
 */

import type { LanguageModel } from 'ai';
import { createLogger } from '@agent/logger';
import type { MemoryStore, MemorySearchResult } from './vectra-store';
import {
  extractFacts,
  type ExtractedFact,
  type MemoryNetworkType,
  type MemoryOperation,
} from './extraction';

const log = createLogger('@agent/sdk:memory-engine');

// ============================================================================
// Types
// ============================================================================

/** Graph store interface — matches QueryPort episode/entity methods */
export interface MemoryGraphStore {
  upsertEpisode(episode: {
    id: string;
    timestamp: string;
    type: 'conversation' | 'observation' | 'action' | 'decision' | 'learning';
    summary: string;
    content: string;
    entities: string[];
    relationships: string[];
  }): Promise<void>;
  linkEpisodeEntity(episodeId: string, entityName: string): Promise<void>;
  getEpisodesByQuery(query: string, limit: number): Promise<Array<{
    id?: string;
    summary?: string;
    content?: string;
    timestamp?: string;
    type?: string;
    properties?: Record<string, unknown>;
  }>>;
  upsertContradiction(contradiction: {
    id: string;
    detectedAt: string;
    resolution_winner: string | null;
    resolution_reasoning: string | null;
    factA_id: string;
    factA_statement: string;
    factA_source: string;
    factA_timestamp: string;
    factB_id: string;
    factB_statement: string;
    factB_source: string;
    factB_timestamp: string;
  }): Promise<void>;
}

/** Contradiction detector interface — matches brain's ContradictionDetector */
export interface ContradictionDetectorPort {
  detect(
    statementA: string,
    statementB: string,
    metadataA?: { id: string; source: string; timestamp: string },
    metadataB?: { id: string; source: string; timestamp: string },
  ): { id: string; factA: Record<string, string>; factB: Record<string, string>; detectedAt: string } | null;
}

/** Result of a unified remember() operation */
export interface MemoryWriteResult {
  id: string;
  operation: MemoryOperation;
  facts: ExtractedFact[];
  vectorStoreId?: string;
  graphStoreId?: string;
  contradiction?: {
    id: string;
    existingFact: string;
    newFact: string;
  };
}

/** Configuration for the unified memory engine */
export interface MemoryEngineConfig {
  /** Vector store for semantic search (Vectra) */
  vectorStore: MemoryStore;
  /** Graph store for structural queries (Graphology via QueryPort) — optional */
  graphStore?: MemoryGraphStore;
  /** LLM for extraction pipeline — optional, extraction disabled without it */
  extractionModel?: LanguageModel;
  /** Contradiction detector — optional */
  contradictionDetector?: ContradictionDetectorPort;
  /** Default top-K for recall */
  defaultTopK?: number;
  /** Default similarity threshold */
  defaultThreshold?: number;
}

/** The unified memory engine interface */
export interface MemoryEngine {
  /** Store text with LLM extraction → parallel writes to vector + graph */
  remember(text: string, metadata?: Record<string, unknown>): Promise<MemoryWriteResult>;
  /** Semantic search via vector store */
  recall(query: string, options?: { topK?: number; threshold?: number }): Promise<MemorySearchResult[]>;
  /** Graph-based knowledge query — returns episodes/entities matching query */
  queryKnowledge(query: string, limit?: number): Promise<Array<Record<string, unknown>>>;
  /** Remove a memory by ID from both stores */
  forget(id: string): Promise<boolean>;
  /** Get stats */
  count(): Promise<number>;
  /** Cleanup */
  close(): Promise<void>;
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * Create a unified memory engine.
 *
 * @example
 * ```typescript
 * const engine = createMemoryEngine({
 *   vectorStore: await createMemoryStore({ path: './.memory' }),
 *   graphStore: new GraphologyAdapter(),
 *   extractionModel: openai('gpt-4o-mini'),
 * });
 *
 * // Single remember() does extraction + parallel writes
 * const result = await engine.remember('TypeScript 5.3 supports import attributes');
 * ```
 */
export function createMemoryEngine(config: MemoryEngineConfig): MemoryEngine {
  const {
    vectorStore,
    graphStore,
    extractionModel,
    contradictionDetector,
    defaultTopK = 5,
    defaultThreshold = 0.7,
  } = config;

  return {
    async remember(text: string, metadata?: Record<string, unknown>): Promise<MemoryWriteResult> {
      const writeId = generateWriteId();
      const timestamp = new Date().toISOString();

      log.debug('remember() — unified write path', { writeId, textLength: text.length });

      // Step 1: Extract facts via LLM (if model provided)
      let facts: ExtractedFact[] = [];
      if (extractionModel) {
        try {
          const done = log.time('extraction');
          const result = await extractFacts(text, { model: extractionModel });
          facts = result.facts;
          done();
          log.info('Extraction complete', { factCount: facts.length });
        } catch (error) {
          log.warn('Extraction failed, continuing with raw text', { error: String(error) });
        }
      }

      // Step 2: Check for contradictions against existing memories
      let contradictionResult: MemoryWriteResult['contradiction'] | undefined;
      if (contradictionDetector && facts.length > 0) {
        try {
          contradictionResult = await detectContradictions(
            facts,
            vectorStore,
            contradictionDetector,
            graphStore,
            defaultTopK,
            defaultThreshold,
          );
        } catch (error) {
          log.warn('Contradiction detection failed, continuing', { error: String(error) });
        }
      }

      // Step 3: Determine operation type
      const operation: MemoryOperation = contradictionResult ? 'UPDATE' : 'ADD';

      // Step 4: Parallel writes to vector store + graph store
      const writePromises: Promise<void>[] = [];
      let vectorStoreId: string | undefined;
      let graphStoreId: string | undefined;

      // Vector store: store the raw text + extracted facts as metadata
      writePromises.push(
        vectorStore.remember(text, {
          ...metadata,
          writeId,
          timestamp,
          operation,
          networks: facts.map((f) => f.network),
          factCount: facts.length,
          facts: facts.map((f) => f.fact),
        }).then((id) => { vectorStoreId = id; }),
      );

      // Graph store: create episode + link entities
      if (graphStore && facts.length > 0) {
        const episodeType = classifyEpisodeType(facts);
        const entityNames = [...new Set(facts.flatMap((f) => f.entities.map((e) => e.name)))];
        const relationshipStrings = facts.flatMap((f) =>
          f.relationships.map((r) => `${r.from}-[${r.type}]->${r.to}`),
        );

        writePromises.push(
          (async () => {
            await graphStore.upsertEpisode({
              id: writeId,
              timestamp,
              type: episodeType,
              summary: facts.map((f) => f.fact).join('; '),
              content: text,
              entities: entityNames,
              relationships: relationshipStrings,
            });
            graphStoreId = writeId;

            // Link entities to the episode
            for (const entityName of entityNames) {
              await graphStore.linkEpisodeEntity(writeId, entityName);
            }
          })(),
        );
      }

      await Promise.all(writePromises);

      log.info('Unified write complete', {
        writeId,
        operation,
        factCount: facts.length,
        vectorStoreId,
        graphStoreId,
        hasContradiction: !!contradictionResult,
      });

      return {
        id: writeId,
        operation,
        facts,
        vectorStoreId,
        graphStoreId,
        contradiction: contradictionResult,
      };
    },

    async recall(query: string, options?: { topK?: number; threshold?: number }): Promise<MemorySearchResult[]> {
      return vectorStore.recall(query, {
        topK: options?.topK ?? defaultTopK,
        threshold: options?.threshold ?? defaultThreshold,
      });
    },

    async queryKnowledge(query: string, limit = 10): Promise<Array<Record<string, unknown>>> {
      if (!graphStore) {
        log.debug('queryKnowledge called without graph store — returning empty');
        return [];
      }

      const episodes = await graphStore.getEpisodesByQuery(query, limit);
      return episodes.map((ep) => ({
        id: ep.id ?? ep.properties?.id,
        summary: ep.summary ?? ep.properties?.summary,
        content: ep.content ?? ep.properties?.content,
        timestamp: ep.timestamp ?? ep.properties?.timestamp,
        type: ep.type ?? ep.properties?.type,
      })) as Array<Record<string, unknown>>;
    },

    async forget(id: string): Promise<boolean> {
      return vectorStore.forget(id);
    },

    async count(): Promise<number> {
      return vectorStore.count();
    },

    async close(): Promise<void> {
      await vectorStore.close();
    },
  };
}

// ============================================================================
// Helpers
// ============================================================================

function generateWriteId(): string {
  return `mem_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Classify the episode type based on the dominant memory network.
 */
function classifyEpisodeType(
  facts: ExtractedFact[],
): 'conversation' | 'observation' | 'action' | 'decision' | 'learning' {
  const counts: Record<MemoryNetworkType, number> = {
    world_fact: 0,
    experience: 0,
    entity_summary: 0,
    belief: 0,
  };

  for (const fact of facts) {
    counts[fact.network]++;
  }

  // Map network types to episode types
  if (counts.experience > 0) return 'action';
  if (counts.belief > 0) return 'decision';
  if (counts.entity_summary > counts.world_fact) return 'observation';
  return 'learning';
}

/**
 * Check new facts against existing memories for contradictions.
 */
async function detectContradictions(
  newFacts: ExtractedFact[],
  vectorStore: MemoryStore,
  detector: ContradictionDetectorPort,
  graphStore: MemoryGraphStore | undefined,
  topK: number,
  threshold: number,
): Promise<MemoryWriteResult['contradiction'] | undefined> {
  // For each new world_fact or belief, check against similar existing memories
  const checkableFacts = newFacts.filter(
    (f) => f.network === 'world_fact' || f.network === 'belief',
  );

  for (const newFact of checkableFacts) {
    const existing = await vectorStore.recall(newFact.fact, { topK, threshold });

    for (const match of existing) {
      const contradiction = detector.detect(
        match.item.text,
        newFact.fact,
        { id: match.item.id, source: 'memory', timestamp: match.item.timestamp.toISOString() },
        { id: 'new', source: 'input', timestamp: new Date().toISOString() },
      );

      if (contradiction) {
        log.info('Contradiction detected', {
          existing: match.item.text.slice(0, 80),
          new: newFact.fact.slice(0, 80),
        });

        // Store the contradiction in graph store if available
        if (graphStore) {
          try {
            await graphStore.upsertContradiction({
              id: contradiction.id,
              detectedAt: contradiction.detectedAt,
              resolution_winner: null,
              resolution_reasoning: null,
              factA_id: match.item.id,
              factA_statement: match.item.text,
              factA_source: 'memory',
              factA_timestamp: match.item.timestamp.toISOString(),
              factB_id: 'new',
              factB_statement: newFact.fact,
              factB_source: 'input',
              factB_timestamp: new Date().toISOString(),
            });
          } catch (error) {
            log.warn('Failed to store contradiction in graph', { error: String(error) });
          }
        }

        return {
          id: contradiction.id,
          existingFact: match.item.text,
          newFact: newFact.fact,
        };
      }
    }
  }

  return undefined;
}

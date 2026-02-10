/**
 * @agent/brain - Brain Factory
 * Creates a connected brain instance with graph, memory, and extraction capabilities
 */

import { createLogger } from '@agent/logger';
import { createClient, createQueries, createOperations, type GraphClient, type GraphQueries, type GraphOperations, type EpisodeRow } from './graph';
import { EntityExtractor, EntityResolver, ContradictionDetector, type ExtractorConfig } from './nlp';
import { ContextAssembler, type AssembledContext } from './context';
import type { Episode, Experience, SearchResult, AnnotatedSample, Sample, Contradiction } from './types';

const logger = createLogger('@agent/brain');

/** Default LLM model for entity extraction */
const DEFAULT_EXTRACTION_MODEL = 'google/gemini-2.0-flash-001';

/** Default max episodes to retain */
const DEFAULT_MAX_EPISODES = 1000;

export type BrainConfig = {
  graph?: {
    host?: string;
    port?: number;
    url?: string;
    graphName?: string;
    username?: string;
    password?: string;
  };
  extraction?: {
    enabled?: boolean;
    model?: string;
  };
  memory?: {
    maxEpisodes?: number;
    autoExtract?: boolean;
  };
};

export interface Brain {
  readonly client: GraphClient;
  readonly queries: GraphQueries;
  readonly operations: GraphOperations;
  readonly extractor: EntityExtractor | null;
  readonly resolver: EntityResolver;
  readonly contradictionDetector: ContradictionDetector;
  readonly contextAssembler: ContextAssembler;

  query(term: string, limit?: number): Promise<SearchResult[]>;
  remember(fact: string, metadata?: Record<string, unknown>): Promise<void>;
  recall(query: string, limit?: number): Promise<Episode[]>;
  extract(text: string, source?: string): Promise<AnnotatedSample>;
  resolveEntity(name: string, type?: string): Promise<string>;
  detectContradictions(fact: string, metadata?: Record<string, unknown>): Promise<Contradiction | null>;
  assembleContext(query: string, tokenBudget?: number): Promise<AssembledContext>;
  recordEpisode(episode: Omit<Episode, 'id' | 'timestamp'>): Promise<Episode>;
  close(): Promise<void>;
}

type InternalConfig = {
  graph: NonNullable<BrainConfig['graph']>;
  extraction: {
    enabled: boolean;
    model: string;
  };
  memory: {
    maxEpisodes: number;
    autoExtract: boolean;
  };
};

class BrainImpl implements Brain {
  readonly client: GraphClient;
  readonly queries: GraphQueries;
  readonly operations: GraphOperations;
  readonly extractor: EntityExtractor | null;
  readonly resolver: EntityResolver;
  readonly contradictionDetector: ContradictionDetector;
  readonly contextAssembler: ContextAssembler;

  private config: InternalConfig;

  constructor(
    client: GraphClient,
    extractor: EntityExtractor | null,
    config: BrainConfig
  ) {
    this.client = client;
    this.queries = createQueries(client);
    this.operations = createOperations(client);
    this.extractor = extractor;
    this.resolver = new EntityResolver(this.operations);
    this.contradictionDetector = new ContradictionDetector();
    this.contextAssembler = new ContextAssembler(this.operations);
    this.config = {
      graph: config.graph ?? {},
      extraction: {
        enabled: config.extraction?.enabled ?? true,
        model: config.extraction?.model ?? DEFAULT_EXTRACTION_MODEL,
      },
      memory: {
        maxEpisodes: config.memory?.maxEpisodes ?? DEFAULT_MAX_EPISODES,
        autoExtract: config.memory?.autoExtract ?? true,
      },
    };
  }

  async query(term: string, limit = 20): Promise<SearchResult[]> {
    logger.debug('query', { term, limit });
    return this.queries.search(term, undefined, limit);
  }

  async remember(fact: string, metadata?: Record<string, unknown>): Promise<void> {
    logger.debug('remember', { factLength: fact.length, metadata });

    const episode: Episode = {
      id: `ep-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      type: 'observation',
      summary: fact.slice(0, 200),
      context: metadata as Episode['context'] ?? {},
      content: fact,
      entities: [],
      relationships: [],
    };

    if (this.extractor && this.config.memory.autoExtract) {
      try {
        const sample: Sample = { id: episode.id, text: fact };
        const annotated = await this.extractor.extract(sample);
        episode.entities = annotated.entities.map((e) => e.text);
        episode.relationships = annotated.relationships.map(
          (r) => `${r.headEntityId}-${r.type}->${r.tailEntityId}`
        );
      } catch (error) {
        logger.warn('Failed to extract entities from fact', { context: String({ error: String(error) }) });
      }
    }

    // Check for contradictions before storing
    try {
      const contradiction = await this.detectContradictions(fact, metadata);
      if (contradiction) {
        logger.info('Contradiction detected', { contradiction });
      }
    } catch (error) {
      logger.error('Failed to detect contradictions', { error });
    }

    await this.operations.upsertEpisode(episode);

    for (const entity of episode.entities) {
      try {
        await this.operations.linkEpisodeEntity(episode.id, entity);
      } catch (error) {
        logger.debug('Failed to link episode entity', { entity, error: String(error) });
      }
    }

    const episodeCount = await this.operations.countEpisodes();
    if (episodeCount > this.config.memory.maxEpisodes) {
      const toDelete = episodeCount - this.config.memory.maxEpisodes;
      const deleted = await this.operations.pruneOldEpisodes(toDelete);
      logger.debug('Pruned old episodes', { toDelete, deleted, remaining: episodeCount - deleted });
    }
  }

  async recall(query: string, limit = 5): Promise<Episode[]> {
    logger.debug('recall', { query, limit });

    const rows = await this.operations.getEpisodesByQuery(query, limit);
    const episodes: Episode[] = [];

    for (const row of rows) {
      const props = row.properties ?? row;
      const episode: Episode = {
        id: props.id as string,
        timestamp: props.timestamp as string,
        type: props.type as Episode['type'],
        summary: props.summary as string,
        content: props.content as string,
        context: {
          project: props.context_project ?? undefined,
          task: props.context_task ?? undefined,
        },
        entities: JSON.parse((props.entities as string) ?? '[]'),
        relationships: JSON.parse((props.relationships as string) ?? '[]'),
        outcome: props.outcome_success !== undefined && props.outcome_success !== null ? {
          success: props.outcome_success as boolean,
          result: props.outcome_result ?? undefined,
          lessons: props.outcome_lessons 
            ? JSON.parse(props.outcome_lessons as string) 
            : undefined,
        } : undefined,
      };
      episodes.push(episode);
    }

    return episodes.slice(0, limit);
  }

  async extract(text: string, source?: string): Promise<AnnotatedSample> {
    if (!this.extractor) {
      throw new Error('Entity extraction is not enabled');
    }

    const sample: Sample = {
      id: `sample-${Date.now()}`,
      text,
      source,
    };

    return this.extractor.extract(sample);
  }

  async resolveEntity(name: string, type?: string): Promise<string> {
    return this.resolver.resolveEntity(name);
  }

  async detectContradictions(fact: string, metadata?: Record<string, unknown>): Promise<Contradiction | null> {
    // 1. Recall recent facts that might be relevant
    // Using a broad search for now. In a real system, we'd use vector search or more specific entity queries.
    // We search for key terms from the fact.
    const searchTerms = fact.split(' ').filter(w => w.length > 4).slice(0, 3).join(' '); // Simple keyword extraction
    const recentEpisodes = await this.recall(searchTerms || fact, 10);

    for (const episode of recentEpisodes) {
      const contradiction = this.contradictionDetector.detect(
        fact,
        episode.content,
        { id: 'new', source: (metadata?.source as string) ?? 'user', timestamp: new Date().toISOString() },
        { id: episode.id, source: 'memory', timestamp: episode.timestamp }
      );

      if (contradiction) {
        // Persist contradiction
        await this.operations.upsertContradiction({
          id: contradiction.id,
          detectedAt: contradiction.detectedAt,
          resolution_winner: null,
          resolution_reasoning: null,
          factA_id: contradiction.factA.id,
          factA_statement: contradiction.factA.statement,
          factA_source: contradiction.factA.source,
          factA_timestamp: contradiction.factA.timestamp,
          factB_id: contradiction.factB.id,
          factB_statement: contradiction.factB.statement,
          factB_source: contradiction.factB.source,
          factB_timestamp: contradiction.factB.timestamp,
        });
        return contradiction;
      }
    }

    return null;
  }

  async assembleContext(query: string, tokenBudget?: number): Promise<AssembledContext> {
    return this.contextAssembler.assemble(query, tokenBudget);
  }

  async recordEpisode(episodeData: Omit<Episode, 'id' | 'timestamp'>): Promise<Episode> {
    const episode: Episode = {
      ...episodeData,
      id: `ep-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
    };

    await this.operations.upsertEpisode(episode);
    logger.debug('recordEpisode', { id: episode.id, type: episode.type });

    return episode;
  }

  async close(): Promise<void> {
    logger.debug('Closing brain');
    await this.client.close();
  }
}

export async function createBrain(config: BrainConfig = {}): Promise<Brain> {
  logger.info('Creating brain', {
    graphHost: config.graph?.host ?? config.graph?.url ?? 'localhost',
    extractionEnabled: config.extraction?.enabled ?? true,
  });

  const client = await createClient(config.graph);
  await client.ensureIndexes();

  const extractor = config.extraction?.enabled !== false
    ? new EntityExtractor({ model: config.extraction?.model })
    : null;

  return new BrainImpl(client, extractor, config);
}

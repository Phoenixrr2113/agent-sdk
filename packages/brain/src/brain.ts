/**
 * @agent/brain - Brain Factory
 * Creates a connected brain instance with graph, memory, and extraction capabilities
 */

import { createLogger } from '@agent/logger';
import { createClient, createQueries, createOperations, type GraphClient, type GraphQueries, type GraphOperations } from './graph';
import { EntityExtractor, type ExtractorConfig } from './nlp';
import type { Episode, Experience, SearchResult, AnnotatedSample, Sample } from './types';

const logger = createLogger('@agent/brain');

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

  query(term: string, limit?: number): Promise<SearchResult[]>;
  remember(fact: string, metadata?: Record<string, unknown>): Promise<void>;
  recall(query: string, limit?: number): Promise<Episode[]>;
  extract(text: string, source?: string): Promise<AnnotatedSample>;
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

  private episodes: Episode[] = [];
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
    this.config = {
      graph: config.graph ?? {},
      extraction: {
        enabled: config.extraction?.enabled ?? true,
        model: config.extraction?.model ?? 'google/gemini-2.0-flash-001',
      },
      memory: {
        maxEpisodes: config.memory?.maxEpisodes ?? 1000,
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

    this.episodes.push(episode);

    if (this.episodes.length > this.config.memory.maxEpisodes) {
      this.episodes = this.episodes.slice(-this.config.memory.maxEpisodes);
    }
  }

  async recall(query: string, limit = 5): Promise<Episode[]> {
    logger.debug('recall', { query, limit });

    const queryLower = query.toLowerCase();
    const scored = this.episodes.map((ep) => {
      let score = 0;

      if (ep.content.toLowerCase().includes(queryLower)) score += 3;
      if (ep.summary.toLowerCase().includes(queryLower)) score += 2;

      for (const entity of ep.entities) {
        if (entity.toLowerCase().includes(queryLower)) score += 1;
      }

      return { episode: ep, score };
    });

    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s) => s.episode);
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

  async recordEpisode(episodeData: Omit<Episode, 'id' | 'timestamp'>): Promise<Episode> {
    const episode: Episode = {
      ...episodeData,
      id: `ep-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
    };

    this.episodes.push(episode);
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

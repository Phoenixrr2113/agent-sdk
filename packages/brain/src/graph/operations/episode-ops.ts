/**
 * Episode and experience graph operations (episodic memory).
 */

import type { GraphClient } from '../client';
import { episodeToNodeProps, experienceToNodeProps } from '../schema';
import { CYPHER } from './cypher';
import { toParams } from './shared';

/**
 * Episode row as returned from FalkorDB query
 */
export interface EpisodeRow {
  properties?: {
    id: string;
    timestamp: string;
    type: string;
    summary: string;
    content: string;
    context_project: string | null;
    context_task: string | null;
    entities: string;
    relationships: string;
    outcome_success: boolean | null;
    outcome_result: string | null;
    outcome_lessons: string | null;
  };
  id?: string;
  timestamp?: string;
  type?: string;
  summary?: string;
  content?: string;
  context_project?: string | null;
  context_task?: string | null;
  entities?: string;
  relationships?: string;
  outcome_success?: boolean | null;
  outcome_result?: string | null;
  outcome_lessons?: string | null;
}

export interface EpisodeOps {
  upsertEpisode(episode: Parameters<typeof episodeToNodeProps>[0]): Promise<void>;
  upsertExperience(experience: Parameters<typeof experienceToNodeProps>[0]): Promise<void>;
  linkEpisodeEntity(episodeId: string, entityName: string): Promise<void>;
  linkEpisodeExperience(episodeId: string): Promise<void>;
  getEpisodesByQuery(query: string, limit: number): Promise<EpisodeRow[]>;
  getEpisodeById(id: string): Promise<EpisodeRow[]>;
  getAllEpisodes(limit: number): Promise<EpisodeRow[]>;
  getExperiencesForEpisode(episodeId: string): Promise<unknown[]>;
  countEpisodes(): Promise<number>;
  pruneOldEpisodes(count: number): Promise<number>;
}

export class EpisodeOpsImpl implements EpisodeOps {
  constructor(private readonly client: GraphClient) {}

  async upsertEpisode(episode: Parameters<typeof episodeToNodeProps>[0]): Promise<void> {
    const props = episodeToNodeProps(episode);
    await this.client.query(CYPHER.UPSERT_EPISODE, { params: toParams(props) });
  }

  async upsertExperience(experience: Parameters<typeof experienceToNodeProps>[0]): Promise<void> {
    const props = experienceToNodeProps(experience);
    await this.client.query(CYPHER.UPSERT_EXPERIENCE, { params: toParams(props) });
  }

  async linkEpisodeEntity(episodeId: string, entityName: string): Promise<void> {
    await this.client.query(CYPHER.LINK_EPISODE_ENTITY, {
      params: { episodeId, entityName },
    });
  }

  async linkEpisodeExperience(episodeId: string): Promise<void> {
    await this.client.query(CYPHER.LINK_EPISODE_EXPERIENCE, {
      params: { episodeId },
    });
  }

  async getEpisodesByQuery(query: string, limit: number): Promise<EpisodeRow[]> {
    const result = await this.client.roQuery(CYPHER.GET_EPISODES_BY_QUERY, {
      params: { query, limit },
    });
    return (result.data ?? []) as EpisodeRow[];
  }

  async getEpisodeById(id: string): Promise<EpisodeRow[]> {
    const result = await this.client.roQuery(CYPHER.GET_EPISODE_BY_ID, {
      params: { id },
    });
    return (result.data ?? []) as EpisodeRow[];
  }

  async getAllEpisodes(limit: number): Promise<EpisodeRow[]> {
    const result = await this.client.roQuery(CYPHER.GET_ALL_EPISODES, {
      params: { limit },
    });
    return (result.data ?? []) as EpisodeRow[];
  }

  async getExperiencesForEpisode(episodeId: string): Promise<unknown[]> {
    const result = await this.client.roQuery(CYPHER.GET_EXPERIENCES_FOR_EPISODE, {
      params: { episodeId },
    });
    return result.data ?? [];
  }

  async countEpisodes(): Promise<number> {
    const result = await this.client.roQuery(CYPHER.COUNT_EPISODES, { params: {} });
    const row = result.data?.[0] as { count?: number } | undefined;
    return row?.count ?? 0;
  }

  async pruneOldEpisodes(count: number): Promise<number> {
    const result = await this.client.query(CYPHER.PRUNE_OLD_EPISODES, {
      params: { limit: count },
    });
    const row = result.data?.[0] as { deleted?: number } | undefined;
    return row?.deleted ?? 0;
  }
}

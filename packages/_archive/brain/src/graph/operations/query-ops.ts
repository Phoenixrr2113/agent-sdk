/**
 * Project and commit graph operations (query/lookup).
 */

import type { GraphClient } from '../client';
import { commitToNodeProps, type CommitEntity } from '../schema';
import type { ProjectEntity } from '../../types';
import { CYPHER } from './cypher';
import { toParams } from './shared';

export interface QueryOps {
  upsertProject(project: ProjectEntity): Promise<void>;
  getProjects(): Promise<ProjectEntity[]>;
  getProjectByRoot(rootPath: string): Promise<ProjectEntity | null>;
  deleteProject(projectId: string): Promise<void>;
  linkProjectFile(projectId: string, filePath: string): Promise<void>;

  upsertCommit(commit: CommitEntity): Promise<void>;
  createModifiedInEdge(
    filePath: string,
    commitHash: string,
    linesAdded?: number,
    linesRemoved?: number,
    complexityDelta?: number
  ): Promise<void>;
}

export class QueryOpsImpl implements QueryOps {
  constructor(private readonly client: GraphClient) {}

  async upsertProject(project: ProjectEntity): Promise<void> {
    await this.client.query(CYPHER.UPSERT_PROJECT, {
      params: {
        id: project.id,
        name: project.name,
        rootPath: project.rootPath,
        createdAt: project.createdAt,
        lastParsed: project.lastParsed,
        fileCount: project.fileCount ?? 0,
      },
    });
  }

  async getProjects(): Promise<ProjectEntity[]> {
    try {
      const result = await this.client.roQuery<{ p: Record<string, unknown> }>(
        CYPHER.GET_ALL_PROJECTS
      );
      return (result.data ?? []).map((row) => this.projectFromRow(row.p));
    } catch (_e: unknown) {
      return [];
    }
  }

  async getProjectByRoot(rootPath: string): Promise<ProjectEntity | null> {
    try {
      const result = await this.client.roQuery<{ p: Record<string, unknown> }>(
        CYPHER.GET_PROJECT_BY_ROOT,
        { params: { rootPath } }
      );
      const row = result.data?.[0];
      return row ? this.projectFromRow(row.p) : null;
    } catch (_e: unknown) {
      return null;
    }
  }

  async deleteProject(projectId: string): Promise<void> {
    await this.client.query(CYPHER.DELETE_PROJECT, { params: { id: projectId } });
  }

  async linkProjectFile(projectId: string, filePath: string): Promise<void> {
    await this.client.query(CYPHER.LINK_PROJECT_FILE, {
      params: { projectId, filePath },
    });
  }

  async upsertCommit(commit: CommitEntity): Promise<void> {
    const props = commitToNodeProps(commit);
    await this.client.query(CYPHER.UPSERT_COMMIT, { params: toParams(props) });
  }

  async createModifiedInEdge(
    filePath: string,
    commitHash: string,
    linesAdded?: number,
    linesRemoved?: number,
    complexityDelta?: number
  ): Promise<void> {
    await this.client.query(CYPHER.CREATE_MODIFIED_IN_EDGE, {
      params: {
        filePath,
        commitHash,
        linesAdded: linesAdded ?? null,
        linesRemoved: linesRemoved ?? null,
        complexityDelta: complexityDelta ?? null,
      },
    });
  }

  private projectFromRow(row: Record<string, unknown>): ProjectEntity {
    const props = (row['properties'] ?? row) as Record<string, unknown>;
    const fileCount = props['fileCount'] as number | undefined;
    const entity: ProjectEntity = {
      id: props['id'] as string,
      name: props['name'] as string,
      rootPath: props['rootPath'] as string,
      createdAt: props['createdAt'] as string,
      lastParsed: props['lastParsed'] as string,
    };
    if (fileCount !== undefined) {
      entity.fileCount = fileCount;
    }
    return entity;
  }
}

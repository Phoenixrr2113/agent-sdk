/**
 * Entity resolution and contradiction graph operations.
 */

import type { GraphClient } from '../client';
import type { EntityAliasNodeProps, ContradictionNodeProps } from '../schema';
import { CYPHER } from './cypher';
import { toParams } from './shared';

export interface EntityOps {
  upsertEntityAlias(alias: EntityAliasNodeProps): Promise<void>;
  createAliasOfEdge(aliasName: string, entityId: string): Promise<void>;
  getEntityAliases(entityId: string): Promise<unknown[]>;
  findCanonicalEntity(aliasName: string): Promise<unknown[]>;

  upsertContradiction(contradiction: ContradictionNodeProps): Promise<void>;
  getUnresolvedContradictions(): Promise<unknown[]>;
  resolveContradiction(id: string, winner: string, reasoning: string): Promise<void>;
}

export class EntityOpsImpl implements EntityOps {
  constructor(private readonly client: GraphClient) {}

  async upsertEntityAlias(alias: EntityAliasNodeProps): Promise<void> {
    await this.client.query(CYPHER.UPSERT_ENTITY_ALIAS, { params: toParams(alias) });
  }

  async createAliasOfEdge(aliasName: string, entityId: string): Promise<void> {
    await this.client.query(CYPHER.CREATE_ALIAS_OF_EDGE, {
      params: { aliasName, entityId },
    });
  }

  async getEntityAliases(entityId: string): Promise<unknown[]> {
    const result = await this.client.roQuery(CYPHER.GET_ENTITY_ALIASES, {
      params: { entityId },
    });
    return result.data ?? [];
  }

  async findCanonicalEntity(aliasName: string): Promise<unknown[]> {
    const result = await this.client.roQuery(CYPHER.FIND_CANONICAL_ENTITY, {
      params: { aliasName },
    });
    return result.data ?? [];
  }

  async upsertContradiction(contradiction: ContradictionNodeProps): Promise<void> {
    await this.client.query(CYPHER.UPSERT_CONTRADICTION, { params: toParams(contradiction) });
  }

  async getUnresolvedContradictions(): Promise<unknown[]> {
    const result = await this.client.roQuery(CYPHER.GET_UNRESOLVED_CONTRADICTIONS, { params: {} });
    return result.data ?? [];
  }

  async resolveContradiction(id: string, winner: string, reasoning: string): Promise<void> {
    await this.client.query(CYPHER.RESOLVE_CONTRADICTION, {
      params: { id, winner, reasoning },
    });
  }
}

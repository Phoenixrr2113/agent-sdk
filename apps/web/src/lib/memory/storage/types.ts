export type Entity = {
  id: string;
  name: string;
  type: string;
  attributes: Record<string, unknown>;
  embedding?: number[];
  createdAt: Date;
  updatedAt: Date;
};

export type Relation = {
  id: string;
  fromEntityId: string;
  toEntityId: string;
  type: string;
  weight: number;
  attributes: Record<string, unknown>;
  createdAt: Date;
};

export type Fact = {
  id: string;
  content: string;
  embedding: number[];
  entityIds: string[];
  relationIds: string[];
  validFrom: Date;
  validTo: Date | null;
  createdAt: Date;
  source: string;
  confidence: number;
};

export type Episode = {
  id: string;
  groupId: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  factIds: string[];
  entityIds: string[];
  timestamp: Date;
  lastProcessedMessageIndex: number;
};

export type SearchResult = {
  facts: Fact[];
  entities: Entity[];
  relations: Relation[];
  score: number;
};

export type MemoryAddInput = {
  content: string;
  role?: 'user' | 'assistant' | 'system';
  groupId?: string;
  source?: string;
  lastProcessedMessageIndex?: number;
};

export type MemorySearchInput = {
  query: string;
  groupIds?: string[];
  maxResults?: number;
  includeExpired?: boolean;
};

export type EntityWithScore = {
  entity: Entity;
  score: number;
};

export type FactWithScore = {
  fact: Fact;
  score: number;
};

export type StorageAdapter = {
  entities: {
    create(entity: Entity): Promise<void>;
    update(id: string, updates: Partial<Entity>): Promise<void>;
    get(id: string): Promise<Entity | null>;
    findByName(name: string): Promise<Entity | null>;
    findByType(type: string): Promise<Entity[]>;
    search(embedding: number[], limit: number): Promise<EntityWithScore[]>;
    all(): Promise<Entity[]>;
  };

  relations: {
    create(relation: Relation): Promise<void>;
    get(id: string): Promise<Relation | null>;
    findByEntity(entityId: string): Promise<Relation[]>;
    findBetween(fromId: string, toId: string): Promise<Relation[]>;
    all(): Promise<Relation[]>;
  };

  facts: {
    create(fact: Fact): Promise<void>;
    update(id: string, updates: Partial<Fact>): Promise<void>;
    get(id: string): Promise<Fact | null>;
    findByEntity(entityId: string): Promise<Fact[]>;
    findValid(asOf?: Date): Promise<Fact[]>;
    search(embedding: number[], limit: number, includeExpired?: boolean): Promise<FactWithScore[]>;
    invalidate(id: string, validTo: Date): Promise<void>;
  };

  episodes: {
    create(episode: Episode): Promise<void>;
    get(id: string): Promise<Episode | null>;
    findByGroup(groupId: string, limit?: number): Promise<Episode[]>;
  };

  transaction<T>(fn: () => Promise<T>): Promise<T>;
  close(): Promise<void>;
};

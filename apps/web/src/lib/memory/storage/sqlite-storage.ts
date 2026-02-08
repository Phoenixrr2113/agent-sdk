import Database from 'better-sqlite3';

import { cosineSimilarity } from '../embeddings/index';

import type { Entity, Relation, Fact, Episode, StorageAdapter, EntityWithScore, FactWithScore } from './types';

function safeJsonParse<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS entities (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    attributes TEXT NOT NULL,
    embedding TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(name);
  CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type);

  CREATE TABLE IF NOT EXISTS relations (
    id TEXT PRIMARY KEY,
    from_entity_id TEXT NOT NULL,
    to_entity_id TEXT NOT NULL,
    type TEXT NOT NULL,
    weight REAL NOT NULL,
    attributes TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (from_entity_id) REFERENCES entities(id),
    FOREIGN KEY (to_entity_id) REFERENCES entities(id)
  );
  CREATE INDEX IF NOT EXISTS idx_relations_from ON relations(from_entity_id);
  CREATE INDEX IF NOT EXISTS idx_relations_to ON relations(to_entity_id);

  CREATE TABLE IF NOT EXISTS facts (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    embedding TEXT NOT NULL,
    entity_ids TEXT NOT NULL,
    relation_ids TEXT NOT NULL,
    valid_from TEXT NOT NULL,
    valid_to TEXT,
    created_at TEXT NOT NULL,
    source TEXT NOT NULL,
    confidence REAL NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_facts_valid ON facts(valid_from, valid_to);

  CREATE TABLE IF NOT EXISTS episodes (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL,
    content TEXT NOT NULL,
    role TEXT NOT NULL,
    fact_ids TEXT NOT NULL,
    entity_ids TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    last_processed_message_index INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_episodes_group ON episodes(group_id, timestamp);
  CREATE INDEX IF NOT EXISTS idx_episodes_group_id ON episodes(group_id);
`;

export function createSQLiteStorage(dbPath: string): StorageAdapter {
  const db = new Database(dbPath);
  let checkpointInterval: ReturnType<typeof setInterval> | null = null;

  try {
    db.pragma('journal_mode = WAL');
    db.pragma('busy_timeout = 5000');
    db.exec(SCHEMA);

    checkpointInterval = setInterval(() => {
      try {
        db.pragma('wal_checkpoint(TRUNCATE)');
      } catch {
        // Ignore checkpoint errors
      }
    }, 60000);
  } catch (error) {
    if (checkpointInterval) {
      clearInterval(checkpointInterval);
    }
    db.close();
    throw error;
  }

  const parseEntity = (row: Record<string, unknown>): Entity => ({
    id: row.id as string,
    name: row.name as string,
    type: row.type as string,
    attributes: safeJsonParse(row.attributes as string, {}),
    embedding: safeJsonParse<number[]>(row.embedding as string, []),
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  });

  const parseFact = (row: Record<string, unknown>): Fact => ({
    id: row.id as string,
    content: row.content as string,
    embedding: safeJsonParse(row.embedding as string, []),
    entityIds: safeJsonParse(row.entity_ids as string, []),
    relationIds: safeJsonParse(row.relation_ids as string, []),
    validFrom: new Date(row.valid_from as string),
    validTo: row.valid_to ? new Date(row.valid_to as string) : null,
    createdAt: new Date(row.created_at as string),
    source: row.source as string,
    confidence: row.confidence as number,
  });

  const parseRelation = (row: Record<string, unknown>): Relation => ({
    id: row.id as string,
    fromEntityId: row.from_entity_id as string,
    toEntityId: row.to_entity_id as string,
    type: row.type as string,
    weight: row.weight as number,
    attributes: safeJsonParse(row.attributes as string, {}),
    createdAt: new Date(row.created_at as string),
  });

  const parseEpisode = (row: Record<string, unknown>): Episode => ({
    id: row.id as string,
    groupId: row.group_id as string,
    content: row.content as string,
    role: row.role as 'user' | 'assistant' | 'system',
    factIds: safeJsonParse(row.fact_ids as string, []),
    entityIds: safeJsonParse(row.entity_ids as string, []),
    timestamp: new Date(row.timestamp as string),
    lastProcessedMessageIndex: row.last_processed_message_index as number,
  });

  return {
    entities: {
      async create(entity) {
        db.prepare('INSERT INTO entities VALUES (?, ?, ?, ?, ?, ?, ?)').run(
          entity.id, entity.name, entity.type, JSON.stringify(entity.attributes),
          entity.embedding ? JSON.stringify(entity.embedding) : null,
          entity.createdAt.toISOString(), entity.updatedAt.toISOString()
        );
      },
      async update(id, updates) {
        const ALLOWED_COLUMNS = ['name', 'attributes', 'embedding'] as const;
        const sets: string[] = [];
        const vals: unknown[] = [];

        for (const key of Object.keys(updates)) {
          if (!ALLOWED_COLUMNS.includes(key as (typeof ALLOWED_COLUMNS)[number])) {
            throw new Error(`Invalid column name for entity update: ${key}`);
          }
        }

        if (updates.name) { sets.push('name = ?'); vals.push(updates.name); }
        if (updates.attributes) { sets.push('attributes = ?'); vals.push(JSON.stringify(updates.attributes)); }
        if (updates.embedding) { sets.push('embedding = ?'); vals.push(JSON.stringify(updates.embedding)); }
        sets.push('updated_at = ?'); vals.push(new Date().toISOString());
        vals.push(id);
        db.prepare(`UPDATE entities SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
      },
      async get(id) {
        const row = db.prepare('SELECT * FROM entities WHERE id = ?').get(id) as Record<string, unknown> | undefined;
        return row ? parseEntity(row) : null;
      },
      async findByName(name) {
        const row = db.prepare('SELECT * FROM entities WHERE LOWER(name) = LOWER(?)').get(name) as Record<string, unknown> | undefined;
        return row ? parseEntity(row) : null;
      },
      async findByType(type) {
        return (db.prepare('SELECT * FROM entities WHERE type = ?').all(type) as Record<string, unknown>[]).map(parseEntity);
      },
      async search(embedding, limit): Promise<EntityWithScore[]> {
        const all: Entity[] = (db.prepare('SELECT * FROM entities WHERE embedding IS NOT NULL').all() as Record<string, unknown>[]).map(parseEntity);
        return all
          .filter((e): e is Entity & { embedding: number[] } => e.embedding !== undefined && e.embedding !== null)
          .map((e): EntityWithScore => ({ entity: e, score: cosineSimilarity(embedding, e.embedding) }))
          .sort((a, b) => b.score - a.score)
          .slice(0, limit);
      },
      async all() {
        return (db.prepare('SELECT * FROM entities').all() as Record<string, unknown>[]).map(parseEntity);
      },
    },

    relations: {
      async create(r) {
        db.prepare('INSERT INTO relations VALUES (?, ?, ?, ?, ?, ?, ?)').run(
          r.id, r.fromEntityId, r.toEntityId, r.type, r.weight,
          JSON.stringify(r.attributes), r.createdAt.toISOString()
        );
      },
      async get(id) {
        const row = db.prepare('SELECT * FROM relations WHERE id = ?').get(id) as Record<string, unknown> | undefined;
        return row ? parseRelation(row) : null;
      },
      async findByEntity(entityId) {
        return (db.prepare('SELECT * FROM relations WHERE from_entity_id = ? OR to_entity_id = ?')
          .all(entityId, entityId) as Record<string, unknown>[]).map(parseRelation);
      },
      async findBetween(fromId, toId) {
        return (db.prepare('SELECT * FROM relations WHERE from_entity_id = ? AND to_entity_id = ?')
          .all(fromId, toId) as Record<string, unknown>[]).map(parseRelation);
      },
      async all() {
        return (db.prepare('SELECT * FROM relations').all() as Record<string, unknown>[]).map(parseRelation);
      },
    },

    facts: {
      async create(f) {
        db.prepare('INSERT INTO facts VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
          f.id, f.content, JSON.stringify(f.embedding), JSON.stringify(f.entityIds),
          JSON.stringify(f.relationIds), f.validFrom.toISOString(),
          f.validTo?.toISOString() || null, f.createdAt.toISOString(), f.source, f.confidence
        );
      },
      async update(id, updates) {
        const ALLOWED_COLUMNS = ['validTo'] as const;

        for (const key of Object.keys(updates)) {
          if (!ALLOWED_COLUMNS.includes(key as (typeof ALLOWED_COLUMNS)[number])) {
            throw new Error(`Invalid column name for fact update: ${key}`);
          }
        }

        if (updates.validTo) {
          db.prepare('UPDATE facts SET valid_to = ? WHERE id = ?').run(updates.validTo.toISOString(), id);
        }
      },
      async get(id) {
        const row = db.prepare('SELECT * FROM facts WHERE id = ?').get(id) as Record<string, unknown> | undefined;
        return row ? parseFact(row) : null;
      },
      async findByEntity(entityId): Promise<Fact[]> {
        const all: Fact[] = (db.prepare('SELECT * FROM facts').all() as Record<string, unknown>[]).map(parseFact);
        return all.filter((f) => f.entityIds.includes(entityId));
      },
      async findValid(asOf = new Date()): Promise<Fact[]> {
        const iso = asOf.toISOString();
        return (db.prepare('SELECT * FROM facts WHERE valid_from <= ? AND (valid_to IS NULL OR valid_to > ?)')
          .all(iso, iso) as Record<string, unknown>[]).map(parseFact);
      },
      async search(embedding, limit, includeExpired = false): Promise<FactWithScore[]> {
        const allFacts: Fact[] = includeExpired
          ? (db.prepare('SELECT * FROM facts').all() as Record<string, unknown>[]).map(parseFact)
          : await this.findValid();
        return allFacts
          .map((f): FactWithScore => ({ fact: f, score: cosineSimilarity(embedding, f.embedding) }))
          .sort((a, b) => b.score - a.score)
          .slice(0, limit);
      },
      async invalidate(id, validTo) {
        db.prepare('UPDATE facts SET valid_to = ? WHERE id = ?').run(validTo.toISOString(), id);
      },
    },

    episodes: {
      async create(e) {
        db.prepare('INSERT INTO episodes VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
          e.id, e.groupId, e.content, e.role,
          JSON.stringify(e.factIds), JSON.stringify(e.entityIds), e.timestamp.toISOString(),
          e.lastProcessedMessageIndex
        );
      },
      async get(id) {
        const row = db.prepare('SELECT * FROM episodes WHERE id = ?').get(id) as Record<string, unknown> | undefined;
        return row ? parseEpisode(row) : null;
      },
      async findByGroup(groupId, limit = 10) {
        return (db.prepare('SELECT * FROM episodes WHERE group_id = ? ORDER BY timestamp DESC LIMIT ?')
          .all(groupId, limit) as Record<string, unknown>[]).map(parseEpisode);
      },
    },

    async transaction<T>(fn: () => Promise<T>) {
      db.exec('BEGIN');
      try {
        const result = await fn();
        db.exec('COMMIT');
        return result;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    async close() {
      if (checkpointInterval) {
        clearInterval(checkpointInterval);
        checkpointInterval = null;
      }
      try {
        db.pragma('wal_checkpoint(TRUNCATE)');
      } catch {
        // Ignore if already closed
      }
      db.close();
    },
  };
}

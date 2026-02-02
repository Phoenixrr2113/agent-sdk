/**
 * @agent/brain - Temporal Types
 * Types for temporal awareness - tracking when facts are valid
 */

export type TemporalMetadata = {
  validFrom: string;
  validTo?: string;
  invalidatedBy?: string;
  source?: string;
  confidence?: number;
};

export type TemporalFact<T> = T & {
  temporal: TemporalMetadata;
};

export type Episode = {
  id: string;
  timestamp: string;
  type: 'conversation' | 'observation' | 'action' | 'decision' | 'learning';
  summary: string;
  context: {
    participants?: string[];
    location?: string;
    project?: string;
    task?: string;
  };
  content: string;
  entities: string[];
  relationships: string[];
  outcome?: {
    success?: boolean;
    result?: string;
    lessons?: string[];
  };
  embeddings?: number[];
};

export type Experience = {
  id: string;
  episodeId: string;
  timestamp: string;
  situation: string;
  action: string;
  result: string;
  evaluation: 'positive' | 'negative' | 'neutral';
  lessonsLearned: string[];
  applicableContexts: string[];
};

export type Contradiction = {
  id: string;
  factA: {
    id: string;
    statement: string;
    source: string;
    timestamp: string;
  };
  factB: {
    id: string;
    statement: string;
    source: string;
    timestamp: string;
  };
  detectedAt: string;
  resolution?: {
    resolvedAt: string;
    winner: 'A' | 'B' | 'merged' | 'both_invalid';
    reasoning: string;
  };
};

export type EntityResolution = {
  canonicalId: string;
  canonicalName: string;
  aliases: Array<{
    alias: string;
    source: string;
    confidence: number;
  }>;
  mergedFrom: string[];
  lastUpdated: string;
};

export function createTemporalFact<T>(
  fact: T,
  source?: string,
  confidence?: number
): TemporalFact<T> {
  return {
    ...fact,
    temporal: {
      validFrom: new Date().toISOString(),
      source,
      confidence,
    },
  };
}

export function invalidateFact<T>(
  fact: TemporalFact<T>,
  invalidatedBy: string
): TemporalFact<T> {
  return {
    ...fact,
    temporal: {
      ...fact.temporal,
      validTo: new Date().toISOString(),
      invalidatedBy,
    },
  };
}

export function isFactValid<T>(fact: TemporalFact<T>, asOf?: Date): boolean {
  const checkDate = asOf ?? new Date();
  const validFrom = new Date(fact.temporal.validFrom);
  const validTo = fact.temporal.validTo
    ? new Date(fact.temporal.validTo)
    : null;

  if (checkDate < validFrom) return false;
  if (validTo && checkDate >= validTo) return false;
  return true;
}

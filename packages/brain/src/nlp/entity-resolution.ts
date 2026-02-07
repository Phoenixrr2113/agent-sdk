/**
 * Entity Resolution Module
 * 
 * Handles deduplication of entities using fuzzy matching and alias detection.
 */

import type { GraphOperations } from '../graph';

export interface EntityResolutionConfig {
  similarityThreshold: number; // 0.0 to 1.0 (default 0.85)
}

export class EntityResolver {
  private operations: GraphOperations;
  private config: EntityResolutionConfig;

  constructor(operations: GraphOperations, config: Partial<EntityResolutionConfig> = {}) {
    this.operations = operations;
    this.config = {
      similarityThreshold: config.similarityThreshold ?? 0.85,
    };
  }

  /**
   * Normalize an entity name for comparison
   */
  normalize(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ') // Collapse whitespace
      .replace(/[^\w\s]/g, ''); // Remove punctuation
  }

  /**
   * Calculate Jaro-Winkler similarity between two strings
   */
  calculateSimilarity(s1: string, s2: string): number {
    const len1 = s1.length;
    const len2 = s2.length;
    
    if (len1 === 0 || len2 === 0) return 0;

    const matchWindow = Math.floor(Math.max(len1, len2) / 2) - 1;
    const matches1 = new Array(len1).fill(false);
    const matches2 = new Array(len2).fill(false);

    let matches = 0;
    let transpositions = 0;

    for (let i = 0; i < len1; i++) {
      const start = Math.max(0, i - matchWindow);
      const end = Math.min(i + matchWindow + 1, len2);

      for (let j = start; j < end; j++) {
        if (!matches2[j] && s1[i] === s2[j]) {
          matches1[i] = true;
          matches2[j] = true;
          matches++;
          break;
        }
      }
    }

    if (matches === 0) return 0;

    let k = 0;
    for (let i = 0; i < len1; i++) {
      if (matches1[i]) {
        while (!matches2[k]) k++;
        if (s1[i] !== s2[k]) transpositions++;
        k++;
      }
    }

    const jaro = ((matches / len1) + (matches / len2) + ((matches - transpositions / 2) / matches)) / 3;
    
    // Winkler modification
    let prefix = 0;
    for (let i = 0; i < Math.min(len1, len2, 4); i++) {
      if (s1[i] === s2[i]) prefix++;
      else break;
    }

    return jaro + (prefix * 0.1 * (1 - jaro));
  }

  /**
   * Find potentially duplicate entities in the graph
   */
  async findDuplicates(entityName: string): Promise<string[]> {
    const normalized = this.normalize(entityName);
    
    // In a real implementation with a large graph, we wouldn't scan everything.
    // We might rely on an index or vector search.
    // For now, we'll query entities with similar normalized names if possible,
    // or just fetch recent entities to check against.
    
    // Simplified: Find entities that 'contain' part of the name to reduce search space
    // Then apply strict Jaro-Winkler locally
    
    // This part depends on what graph operations are available.
    // Assuming we can get a list of entities (maybe by type or recent).
    // Let's assume we are checking against a set of candidates provided or fetched.
    
    return []; // Placeholder until we wire up specific graph queries
  }

  /**
   * Resolve an entity name to its canonical form or create a new alias
   */
  async resolveEntity(name: string, type: string): Promise<string> {
    // 1. Check if exact match exists
    // 2. Check if alias exists
    // 3. Find candidates with high similarity
    // 4. If match > threshold, link as alias and return canonical
    // 5. Else return original name
    
    // This logic requires graph read/write access.
    // For this implementation plan, we are adding the logic class.
    // Integration into `brain.ts` comes next.
    
    return name;
  }
}

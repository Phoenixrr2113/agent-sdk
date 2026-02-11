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
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s]/g, '');
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

    const jaro =
      (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3;

    // Winkler modification
    let prefix = 0;
    for (let i = 0; i < Math.min(len1, len2, 4); i++) {
      if (s1[i] === s2[i]) prefix++;
      else break;
    }

    return jaro + prefix * 0.1 * (1 - jaro);
  }

  /**
   * Find potentially duplicate entities by checking existing aliases.
   * Returns alias names that match above the similarity threshold.
   */
  async findDuplicates(entityName: string): Promise<string[]> {
    const normalized = this.normalize(entityName);

    // Query existing aliases for this entity to find close matches
    const aliases = await this.operations.getEntityAliases(entityName);
    const duplicates: string[] = [];

    for (const alias of aliases) {
      const aliasRecord = alias as { name?: string; properties?: { name?: string } };
      const aliasName =
        aliasRecord.name ?? aliasRecord.properties?.name;
      if (!aliasName) continue;

      const similarity = this.calculateSimilarity(normalized, this.normalize(aliasName));
      if (similarity >= this.config.similarityThreshold) {
        duplicates.push(aliasName);
      }
    }

    return duplicates;
  }

  /**
   * Resolve an entity name to its canonical form.
   * If an alias exists that maps to a canonical entity, return that.
   * Otherwise return the original name.
   */
  async resolveEntity(name: string): Promise<string> {
    // Check if this name is a known alias
    const canonical = await this.operations.findCanonicalEntity(name);
    if (canonical.length > 0) {
      const entity = canonical[0] as { name?: string; properties?: { name?: string } };
      const resolved = entity.name ?? entity.properties?.name;
      if (resolved) return resolved;
    }

    return name;
  }
}

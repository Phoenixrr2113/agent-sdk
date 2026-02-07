/**
 * Contradiction Detection Module
 * 
 * Identifies conflicting facts or statements.
 */

import type { Contradiction } from '../types';

export class ContradictionDetector {
  /**
   * Detect contradictions between two statements
   */
  detect(
    statementA: string, 
    statementB: string,
    metadataA?: { id: string; source: string; timestamp: string },
    metadataB?: { id: string; source: string; timestamp: string }
  ): Contradiction | null {
    
    if (this.areStatementsContradictory(statementA, statementB)) {
      return {
        id: `conflict-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        factA: {
          id: metadataA?.id ?? 'unknown',
          statement: statementA,
          source: metadataA?.source ?? 'unknown',
          timestamp: metadataA?.timestamp ?? new Date().toISOString(),
        },
        factB: {
          id: metadataB?.id ?? 'unknown',
          statement: statementB,
          source: metadataB?.source ?? 'unknown',
          timestamp: metadataB?.timestamp ?? new Date().toISOString(),
        },
        detectedAt: new Date().toISOString(),
      };
    }
    
    return null;
  }

  private areStatementsContradictory(a: string, b: string): boolean {
    const normA = a.toLowerCase();
    const normB = b.toLowerCase();

    // 1. Numeric contradictions
    // Example: "timeout is 30s" vs "timeout is 60s"
    if (this.hasNumericConflict(normA, normB)) {
      return true;
    }

    // 2. Boolean/Negation contradictions
    // Example: "is enabled" vs "is not enabled"
    if (this.hasNegationConflict(normA, normB)) {
      return true;
    }

    return false;
  }

  private hasNumericConflict(a: string, b: string): boolean {
    // Extract numbers
    const numsA = a.match(/\d+/g);
    const numsB = b.match(/\d+/g);

    if (!numsA || !numsB) return false;

    // Very naive: if they share many words but have different numbers
    const wordsA = new Set(a.split(/\s+/));
    const wordsB = new Set(b.split(/\s+/));
    
    const intersection = [...wordsA].filter(x => wordsB.has(x));
    const jaccard = intersection.length / (wordsA.size + wordsB.size - intersection.length);

    // If sentences are very similar (high Jaccard) but numbers differ
    if (jaccard > 0.6 && numsA.join(',') !== numsB.join(',')) {
      return true;
    }

    return false;
  }

  private hasNegationConflict(a: string, b: string): boolean {
    // Check if one contains "not" or "no" or "disable" vs "enable"
    // and the rest of the sentence is similar
    
    // Simplify: check if one has "not" and the other doesn't, and high similarity
    // Or "enabled" vs "disabled"
    
    // Check specific pairs
    if (a.includes('enabled') && b.includes('disabled') && this.similarity(a, b) > 0.6) return true;
    if (a.includes('disabled') && b.includes('enabled') && this.similarity(a, b) > 0.6) return true;
    if (a.includes('true') && b.includes('false') && this.similarity(a, b) > 0.6) return true;
    if (a.includes('false') && b.includes('true') && this.similarity(a, b) > 0.6) return true;

    return false;
  }

  private similarity(a: string, b: string): number {
    const wordsA = new Set(a.split(/\s+/));
    const wordsB = new Set(b.split(/\s+/));
    const intersection = [...wordsA].filter(x => wordsB.has(x));
    return intersection.length / (wordsA.size + wordsB.size - intersection.length);
  }
}

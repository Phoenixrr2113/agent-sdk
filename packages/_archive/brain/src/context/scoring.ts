/**
 * Context Scoring Module
 * 
 * Scores nodes and episodes for relevance to a query.
 */

export interface ScoredItem<T> {
  item: T;
  score: number;
  reason: string;
}

export class ContextScorer {
  /**
   * Score items based on relevance to query and recency
   */
  scoreItems<T extends { content?: string; summary?: string; timestamp?: string }>(
    items: T[],
    query: string
  ): ScoredItem<T>[] {
    if (!items) return [];
    const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    const now = Date.now();

    return items.map(item => {
      let score = 0;
      const text = ((item.content || '') + ' ' + (item.summary || '')).toLowerCase();
      
      // 1. Term Frequency (simplified)
      let matches = 0;
      for (const term of queryTerms) {
        // Count occurrences
        const regex = new RegExp(this.escapeRegExp(term), 'g');
        const count = (text.match(regex) || []).length;
        if (count > 0) matches++;
        score += count * 1.0;
      }

      // Boost for exact phrase match
      if (text.includes(query.toLowerCase())) {
        score += 5.0;
      }

      // 2. Recency Decay
      // Higher score for recent items
      if (item.timestamp) {
        const itemTime = new Date(item.timestamp).getTime();
        const ageHours = (now - itemTime) / (1000 * 60 * 60);
        // Decay factor: 1.0 at 0 hours, 0.5 at 24 hours, etc.
        const recencyFactor = 1 / (1 + ageHours / 24);
        score *= (1 + recencyFactor);
      }

      return {
        item,
        score,
        reason: `Matches: ${matches}, Score: ${score.toFixed(2)}`
      };
    }).sort((a, b) => b.score - a.score);
  }

  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

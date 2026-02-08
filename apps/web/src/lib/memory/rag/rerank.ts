export type RerankDocument = {
  id: string;
  content: string;
};

export type RerankResult = {
  id: string;
  score: number;
  rank: number;
};

export type RerankOptions = {
  topN?: number;
};

function simpleRelevanceScore(query: string, content: string): number {
  const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  const contentLower = content.toLowerCase();
  
  let matchCount = 0;
  let exactMatches = 0;
  
  for (const term of queryTerms) {
    if (contentLower.includes(term)) {
      matchCount++;
      const regex = new RegExp(`\\b${term}\\b`, 'gi');
      const matches = content.match(regex);
      exactMatches += matches ? matches.length : 0;
    }
  }
  
  if (queryTerms.length === 0) return 0;
  
  const termCoverage = matchCount / queryTerms.length;
  const densityBonus = Math.min(exactMatches / 10, 0.3);
  
  return termCoverage * 0.7 + densityBonus;
}

export async function rerankDocuments(
  query: string,
  documents: RerankDocument[],
  options: RerankOptions = {}
): Promise<RerankResult[]> {
  const { topN = 20 } = options;

  if (documents.length === 0) {
    return [];
  }

  const scored = documents.map((doc) => ({
    id: doc.id,
    score: simpleRelevanceScore(query, doc.content),
  }));

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, topN).map((result, index) => ({
    id: result.id,
    score: result.score,
    rank: index + 1,
  }));
}

export async function rerankWithFallback(
  query: string,
  documents: RerankDocument[],
  options: RerankOptions = {}
): Promise<RerankResult[]> {
  try {
    return await rerankDocuments(query, documents, options);
  } catch {
    return documents.slice(0, options.topN || 20).map((document, index) => ({
      id: document.id,
      score: 1 - index / documents.length,
      rank: index + 1,
    }));
  }
}

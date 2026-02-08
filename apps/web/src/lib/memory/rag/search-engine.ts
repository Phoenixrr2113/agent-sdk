import { embed } from 'ai';

import { getEmbeddingModel, cosineSimilarity } from '../embeddings/index';

import { mergeSearchResults, type BM25Index } from './bm25';
import { rerankWithFallback } from './rerank';
import type { EmbeddedChunk, SearchOptions, SearchConfig, SearchState } from './types';

async function searchSingleQuery(
  query: string,
  state: SearchState,
  config: SearchConfig
): Promise<Array<{ id: string; score: number }>> {
  const model = getEmbeddingModel();
  const { embedding: queryEmbedding } = await embed({
    model: model as unknown as Parameters<typeof embed>[0]['model'],
    value: query,
  });

  const embeddingResults = state.embeddedChunks
    .map((chunk) => ({
      id: chunk.id,
      score: cosineSimilarity(queryEmbedding, chunk.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, config.rerankTopN)
    .map((r, index) => ({ ...r, rank: index + 1 }));

  if (config.enableBM25 && state.bm25Index) {
    const bm25Results = state.bm25Index.search(query, config.rerankTopN);
    return mergeSearchResults(embeddingResults, bm25Results).slice(0, config.rerankTopN);
  }

  return embeddingResults;
}

function combineExpandedResults(
  resultsByQuery: Map<string, Array<{ id: string; score: number }>>,
  originalQuery: string
): Array<{ id: string; score: number }> {
  const scores = new Map<string, number>();
  const originalWeight = 2.0;
  const expandedWeight = 1.0;

  for (const [query, results] of resultsByQuery.entries()) {
    const weight = query === originalQuery ? originalWeight : expandedWeight;
    for (const result of results) {
      const current = scores.get(result.id) || 0;
      scores.set(result.id, current + result.score * weight);
    }
  }

  return Array.from(scores.entries())
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score);
}

function countTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function filterChunksToFitBudget(chunks: EmbeddedChunk[], maxTokens: number): EmbeddedChunk[] {
  const result: EmbeddedChunk[] = [];
  let totalTokens = 0;

  for (const chunk of chunks) {
    const chunkTokens = countTokens(chunk.contextualContent);
    if (totalTokens + chunkTokens > maxTokens) {
      break;
    }
    result.push(chunk);
    totalTokens += chunkTokens;
  }

  return result;
}

export async function executeSearch(
  query: string,
  options: SearchOptions | undefined,
  state: SearchState,
  config: SearchConfig
): Promise<EmbeddedChunk[]> {
  const finalTopK = options?.topK ?? config.returnTopN;
  const maxTokens = options?.maxTokens ?? config.maxTokensPerSearch;

  if (state.embeddedChunks.length === 0) {
    return [];
  }

  const allQueries = [query];

  const resultsByQuery = new Map<string, Array<{ id: string; score: number }>>();

  const searchPromises = allQueries.map(async (q) => {
    const results = await searchSingleQuery(q, state, config);
    resultsByQuery.set(q, results);
  });

  await Promise.all(searchPromises);

  const mergedResults = combineExpandedResults(resultsByQuery, query);
  const candidateIds = mergedResults.slice(0, config.rerankTopN).map(r => r.id);

  let finalIds: string[];

  if (config.enableReranking && candidateIds.length > 0) {
    const docsToRerank = candidateIds
      .map((id) => state.chunkMap.get(id))
      .filter((c): c is EmbeddedChunk => c !== undefined)
      .map((c) => ({ id: c.id, content: c.contextualContent }));

    const reranked = await rerankWithFallback(query, docsToRerank, {
      topN: finalTopK,
    });
    finalIds = reranked.map((r) => r.id);
  } else {
    finalIds = candidateIds.slice(0, finalTopK);
  }

  let results = finalIds
    .map((id) => state.chunkMap.get(id))
    .filter((c): c is EmbeddedChunk => c !== undefined);

  if (maxTokens !== undefined && maxTokens > 0) {
    results = filterChunksToFitBudget(results, maxTokens);
  }

  return results;
}

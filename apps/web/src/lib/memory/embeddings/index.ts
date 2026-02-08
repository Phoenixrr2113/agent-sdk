import { openai } from '@ai-sdk/openai';
import { embed, embedMany } from 'ai';

type EmbeddingModelType = ReturnType<typeof openai.embedding>;

export function getEmbeddingModel(modelOverride?: string): EmbeddingModelType {
  const modelName = modelOverride || process.env['OPENAI_EMBEDDING_MODEL'] || 'text-embedding-3-small';
  return openai.embedding(modelName);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0) {
    return 0;
  }

  if (a.length !== b.length) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let index = 0; index < a.length; index++) {
    const valueA = a[index] ?? 0;
    const valueB = b[index] ?? 0;
    dotProduct += valueA * valueB;
    normA += valueA * valueA;
    normB += valueB * valueB;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

export type EmbeddingService = {
  embed(text: string): Promise<number[]>;
  embedMany(texts: string[]): Promise<number[][]>;
  cosineSimilarity(a: number[], b: number[]): number;
  model: EmbeddingModelType;
};

export function createEmbeddingService(modelOverride?: string): EmbeddingService {
  const model = getEmbeddingModel(modelOverride);

  return {
    model,

    async embed(text: string): Promise<number[]> {
      const result = await embed({ model: model as unknown as Parameters<typeof embed>[0]['model'], value: text });
      return result.embedding;
    },

    async embedMany(texts: string[]): Promise<number[][]> {
      if (texts.length === 0) return [];
      const result = await embedMany({ model: model as unknown as Parameters<typeof embedMany>[0]['model'], values: texts });
      return result.embeddings;
    },

    cosineSimilarity,
  };
}

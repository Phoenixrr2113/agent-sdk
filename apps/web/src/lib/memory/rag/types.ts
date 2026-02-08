import type { ContextualChunk } from './chunking';
import type { BM25Index } from './bm25';

export type { ContextualChunk } from './chunking';
export type { Chunk, ChunkMetadata, ChunkingOptions } from './chunking';

export type EmbeddedChunk = ContextualChunk & {
  id: string;
  embedding: number[];
};

export type CachedFileData = {
  chunks: EmbeddedChunk[];
  hash: string;
};

export type SearchOptions = {
  topK?: number;
  maxTokens?: number;
};

export type SearchState = {
  embeddedChunks: EmbeddedChunk[];
  bm25Index: BM25Index | null;
  chunkMap: Map<string, EmbeddedChunk>;
};

export type SearchConfig = {
  returnTopN: number;
  maxTokensPerSearch: number;
  rerankTopN: number;
  enableBM25: boolean;
  enableReranking: boolean;
  enableQueryExpansion?: boolean;
};

export type RAGOptions = {
  enableCache?: boolean;
  enableContextGeneration?: boolean;
  enableBM25?: boolean;
  enableReranking?: boolean;
  enableQueryExpansion?: boolean;
  rerankTopN?: number;
  returnTopN?: number;
  maxTokensPerSearch?: number;
  onProgress?: (message: string) => void;
};

export type CodebaseRAG = {
  indexCodebase: () => Promise<void>;
  searchCodebase: (query: string, options?: SearchOptions) => Promise<EmbeddedChunk[]>;
  getStats: () => { totalChunks: number; files: number };
  clearCache: () => Promise<void>;
  dispose: () => void;
};

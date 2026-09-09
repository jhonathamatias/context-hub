import { Token } from 'typedi';

export type SemanticSearchQuery = {
  queryVector: number[];
  model: string;
  sourceId?: string;
  limit?: number;
};

export type SemanticSearchHit = {
  embeddingId: string;
  chunkId: string;
  sourceId: string;
  transcriptionId: string;
  chunkIndex: number;
  text: string;
  normalizedText: string;
  startSeconds: number;
  endSeconds: number;
  model: string;
  dimension: number;
  distance: number;
  score: number;
};

/**
 * Port for semantic retrieval. Infrastructure (pgvector) stays behind this interface.
 */
export interface VectorRepository {
  syncEmbedding(embeddingId: string, values: number[]): Promise<void>;
  search(query: SemanticSearchQuery): Promise<SemanticSearchHit[]>;
}

export const VECTOR_REPOSITORY = new Token<VectorRepository>('VectorRepository');

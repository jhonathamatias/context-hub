import type { FastifyBaseLogger } from 'fastify';
import { Inject, Service } from 'typedi';
import {
  EMBEDDING_PROVIDER,
  type EmbeddingProvider,
} from '../embeddings';
import { withProcessingLog } from '../observability';
import {
  VECTOR_REPOSITORY,
  type SemanticSearchHit,
  type VectorRepository,
} from './types';

export type SearchRequest = {
  query: string;
  sourceId?: string;
  sourceIds?: string[];
  limit?: number;
};

export type SearchResponse = {
  query: string;
  model: string;
  provider: string;
  sourceId: string | null;
  sourceIds: string[] | null;
  resultCount: number;
  results: SemanticSearchHit[];
};

@Service()
export class SemanticSearchService {
  constructor(
    @Inject(EMBEDDING_PROVIDER)
    private readonly embeddings: EmbeddingProvider,
    @Inject(VECTOR_REPOSITORY)
    private readonly vectors: VectorRepository,
  ) {}

  async search(
    request: SearchRequest,
    logger: FastifyBaseLogger,
  ): Promise<SearchResponse> {
    const query = request.query.trim();
    if (!query) {
      const error = new Error('query must not be empty');
      (error as Error & { statusCode?: number }).statusCode = 400;
      throw error;
    }

    return withProcessingLog(
      logger,
      'INDEX',
      {
        sourceId: request.sourceId ?? null,
        model: this.embeddings.model,
        provider: this.embeddings.name,
      },
      async () => {
        const embedded = await this.embeddings.embed([query]);
        const queryVector = embedded.vectors[0];
        if (!queryVector) {
          throw new Error('Embedding provider returned no query vector');
        }

        const sourceIds = [
          ...new Set([
            ...(request.sourceIds ?? []),
            ...(request.sourceId ? [request.sourceId] : []),
          ]),
        ];

        const results = await this.vectors.search({
          queryVector,
          model: embedded.model,
          ...(sourceIds.length > 0 ? { sourceIds } : {}),
          ...(request.limit !== undefined ? { limit: request.limit } : {}),
        });

        return {
          query,
          model: embedded.model,
          provider: this.embeddings.name,
          sourceId: sourceIds[0] ?? null,
          sourceIds: sourceIds.length > 0 ? sourceIds : null,
          resultCount: results.length,
          results,
        };
      },
    );
  }
}

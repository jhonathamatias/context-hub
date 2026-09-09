import type { FastifyBaseLogger } from 'fastify';
import { Service } from 'typedi';
import { SemanticSearchService } from '../search';
import { withProcessingLog } from '../observability';
import { assembleContext } from './assemble';
import { filterAndDedupeHits } from './dedupe';
import {
  DEFAULT_RETRIEVAL_OPTIONS,
  type AssembledContext,
  type RetrievalOptions,
} from './types';

export type RetrieveContextRequest = {
  question: string;
  sourceId?: string;
  sourceIds?: string[];
  options?: Partial<RetrievalOptions>;
};

export type RetrieveContextResult = {
  context: AssembledContext;
  hitCount: number;
  provider: string;
  model: string;
};

@Service()
export class ContextRetrievalService {
  constructor(private readonly search: SemanticSearchService) {}

  async retrieve(
    request: RetrieveContextRequest,
    logger: FastifyBaseLogger,
  ): Promise<RetrieveContextResult> {
    const options: RetrievalOptions = {
      ...DEFAULT_RETRIEVAL_OPTIONS,
      ...request.options,
    };

    return withProcessingLog(
      logger,
      'INDEX',
      {
        sourceId: request.sourceId ?? request.sourceIds?.[0] ?? null,
        stage: 'context-retrieval',
      },
      async () => {
        const searchResult = await this.search.search(
          {
            query: request.question,
            ...(request.sourceId ? { sourceId: request.sourceId } : {}),
            ...(request.sourceIds ? { sourceIds: request.sourceIds } : {}),
            limit: options.fetchLimit,
          },
          logger,
        );

        const ranked = [...searchResult.results].sort(
          (a, b) => b.score - a.score,
        );
        const filtered = filterAndDedupeHits(ranked, {
          minScore: options.minScore,
          dedupeOverlap: options.dedupeOverlap,
          maxPassages: options.maxPassages,
        });

        const context = assembleContext(filtered, {
          maxChars: options.maxChars,
          minScore: options.minScore,
        });

        return {
          context,
          hitCount: searchResult.resultCount,
          provider: searchResult.provider,
          model: searchResult.model,
        };
      },
    );
  }
}

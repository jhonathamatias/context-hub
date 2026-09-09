import type { FastifyBaseLogger } from 'fastify';
import { Inject, Service } from 'typedi';
import { withProcessingLog } from '../observability';
import {
  ANSWER_GENERATION_PROVIDER,
} from './answer.providers';
import { ContextRetrievalService } from './retrieval.service';
import type {
  AnswerGenerationProvider,
  AskRequest,
  AskResponse,
  ContextCitation,
} from './types';

@Service()
export class ContextEngineService {
  constructor(
    private readonly retrieval: ContextRetrievalService,
    @Inject(ANSWER_GENERATION_PROVIDER)
    private readonly answers: AnswerGenerationProvider,
  ) {}

  async ask(
    request: AskRequest,
    logger: FastifyBaseLogger,
  ): Promise<AskResponse> {
    const question = request.question.trim();
    if (!question) {
      const error = new Error('question must not be empty');
      (error as Error & { statusCode?: number }).statusCode = 400;
      throw error;
    }

    const mode = request.mode ?? 'course';

    return withProcessingLog(
      logger,
      'INDEX',
      {
        sourceId: request.sourceId ?? null,
        stage: 'context-engine',
        mode,
      },
      async () => {
        const retrieved = await this.retrieval.retrieve(
          {
            question,
            ...(request.sourceId ? { sourceId: request.sourceId } : {}),
            ...(request.sourceIds ? { sourceIds: request.sourceIds } : {}),
            ...(request.limit !== undefined
              ? { options: { maxPassages: request.limit } }
              : {}),
          },
          logger,
        );

        const generated = await this.answers.generate({
          question,
          mode,
          context: retrieved.context,
          ...(request.history ? { history: request.history } : {}),
        });

        const citations: ContextCitation[] =
          generated.citationIndexes.length > 0
            ? retrieved.context.passages.filter((passage) =>
                generated.citationIndexes.includes(passage.index),
              )
            : generated.sufficientEvidence
              ? retrieved.context.passages
              : [];

        return {
          question,
          mode,
          answer: generated.answer,
          sufficientEvidence: generated.sufficientEvidence,
          citations,
          references: citations,
          retrieval: {
            hitCount: retrieved.hitCount,
            usedCount: retrieved.context.passages.length,
            provider: retrieved.provider,
            model: retrieved.model,
          },
        };
      },
    );
  }
}

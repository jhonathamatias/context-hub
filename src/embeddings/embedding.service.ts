import type { FastifyBaseLogger } from 'fastify';
import { In } from 'typeorm';
import { Inject, Service, Token } from 'typedi';
import {
  ChunkEmbedding,
  DatabaseService,
  ProcessingJob,
  ProcessingJobStatus,
  ProcessingStage,
  Source,
  SourceStatus,
  TranscriptChunk,
  Transcription,
  TranscriptionStatus,
} from '../database';
import { env } from '../config/env';
import { withProcessingLog } from '../observability';
import {
  VECTOR_REPOSITORY,
  type VectorRepository,
} from '../search/types';
import {
  batchItems,
  hashEmbeddingContent,
  shouldSkipEmbedding,
} from './content-hash';
import type { EmbeddingProvider } from './types';

export const EMBEDDING_PROVIDER = new Token<EmbeddingProvider>(
  'EmbeddingProvider',
);

export type ProcessEmbeddingsResult = {
  sourceId: string;
  transcriptionId: string;
  chunkCount: number;
  embeddedCount: number;
  skippedCount: number;
  provider: string;
  model: string;
  dimension: number | null;
};

@Service()
export class EmbeddingService {
  constructor(
    private readonly database: DatabaseService,
    @Inject(EMBEDDING_PROVIDER)
    private readonly provider: EmbeddingProvider,
    @Inject(VECTOR_REPOSITORY)
    private readonly vectors: VectorRepository,
  ) {}

  async processSource(
    sourceId: string,
    logger: FastifyBaseLogger,
  ): Promise<ProcessEmbeddingsResult> {
    const sourceRepo = this.database.getRepository(Source);
    const transcriptionRepo = this.database.getRepository(Transcription);
    const chunkRepo = this.database.getRepository(TranscriptChunk);
    const embeddingRepo = this.database.getRepository(ChunkEmbedding);
    const jobRepo = this.database.getRepository(ProcessingJob);

    const source = await sourceRepo.findOne({ where: { id: sourceId } });
    if (!source) {
      const error = new Error(`Source not found: ${sourceId}`);
      (error as Error & { statusCode?: number }).statusCode = 404;
      throw error;
    }

    const transcription = await transcriptionRepo.findOne({
      where: {
        sourceId,
        status: TranscriptionStatus.COMPLETED,
      },
      order: { createdAt: 'DESC' },
    });

    if (!transcription) {
      const error = new Error(
        `Completed transcription not found for source ${sourceId}`,
      );
      (error as Error & { statusCode?: number }).statusCode = 409;
      throw error;
    }

    const chunks = await chunkRepo.find({
      where: { transcriptionId: transcription.id },
      order: { chunkIndex: 'ASC' },
    });

    if (chunks.length === 0) {
      const error = new Error(
        `No transcript chunks found for source ${sourceId}. Run knowledge/chunking first.`,
      );
      (error as Error & { statusCode?: number }).statusCode = 409;
      throw error;
    }

    source.status = SourceStatus.PROCESSING;
    await sourceRepo.save(source);

    const embedJob = jobRepo.create({
      sourceId,
      stage: ProcessingStage.EMBED,
      status: ProcessingJobStatus.RUNNING,
      startedAt: new Date(),
      finishedAt: null,
      errorMessage: null,
    });
    await jobRepo.save(embedJob);

    try {
      const result = await withProcessingLog(
        logger,
        ProcessingStage.EMBED,
        {
          sourceId,
          transcriptionId: transcription.id,
          provider: this.provider.name,
          model: this.provider.model,
          chunkCount: chunks.length,
        },
        async () => {
          const existing = await embeddingRepo.find({
            where: {
              chunkId: In(chunks.map((chunk) => chunk.id)),
              model: this.provider.model,
            },
          });
          const existingByChunkId = new Map(
            existing.map((row) => [row.chunkId, row]),
          );

          const pending: Array<{
            chunk: TranscriptChunk;
            contentHash: string;
            existing?: ChunkEmbedding;
          }> = [];
          let skippedCount = 0;

          for (const chunk of chunks) {
            const content = chunk.normalizedText.trim();
            if (!content) {
              skippedCount += 1;
              continue;
            }

            const contentHash = hashEmbeddingContent(content);
            const current = existingByChunkId.get(chunk.id);

            if (
              current &&
              shouldSkipEmbedding(
                {
                  model: current.model,
                  dimension: current.dimension,
                  contentHash: current.contentHash,
                },
                {
                  model: this.provider.model,
                  dimension: this.provider.dimension,
                  contentHash,
                },
              )
            ) {
              skippedCount += 1;
              continue;
            }

            pending.push({
              chunk,
              contentHash,
              ...(current ? { existing: current } : {}),
            });
          }

          let embeddedCount = 0;
          let dimension: number | null =
            this.provider.dimension ??
            existing.find((row) => row.model === this.provider.model)
              ?.dimension ??
            null;

          if (pending.length === 0) {
            logger.info(
              {
                sourceId,
                transcriptionId: transcription.id,
                chunkCount: chunks.length,
                skippedCount,
              },
              'All chunk embeddings up to date; skipping provider calls',
            );
            return {
              sourceId,
              transcriptionId: transcription.id,
              chunkCount: chunks.length,
              embeddedCount: 0,
              skippedCount,
              provider: this.provider.name,
              model: this.provider.model,
              dimension,
            } satisfies ProcessEmbeddingsResult;
          }

          const batches = batchItems(pending, env.embedding.batchSize);
          for (const batch of batches) {
            const texts = batch.map((item) => item.chunk.normalizedText.trim());
            const embedded = await this.provider.embed(texts);
            dimension = embedded.dimension;

            for (let i = 0; i < batch.length; i += 1) {
              const item = batch[i]!;
              const values = embedded.vectors[i];
              if (!values) {
                throw new Error(
                  `Missing embedding vector for chunk ${item.chunk.id}`,
                );
              }

              if (values.length !== embedded.dimension) {
                throw new Error(
                  `Embedding dimension mismatch for chunk ${item.chunk.id}: expected ${embedded.dimension}, got ${values.length}`,
                );
              }

              if (item.existing) {
                item.existing.provider = this.provider.name;
                item.existing.model = embedded.model;
                item.existing.dimension = embedded.dimension;
                item.existing.contentHash = item.contentHash;
                item.existing.values = values;
                const saved = await embeddingRepo.save(item.existing);
                await this.vectors.syncEmbedding(saved.id, values);
              } else {
                const saved = await embeddingRepo.save(
                  embeddingRepo.create({
                    chunkId: item.chunk.id,
                    sourceId,
                    transcriptionId: transcription.id,
                    provider: this.provider.name,
                    model: embedded.model,
                    dimension: embedded.dimension,
                    contentHash: item.contentHash,
                    values,
                  }),
                );
                await this.vectors.syncEmbedding(saved.id, values);
              }

              embeddedCount += 1;
            }
          }

          return {
            sourceId,
            transcriptionId: transcription.id,
            chunkCount: chunks.length,
            embeddedCount,
            skippedCount,
            provider: this.provider.name,
            model: this.provider.model,
            dimension,
          } satisfies ProcessEmbeddingsResult;
        },
      );

      embedJob.status = ProcessingJobStatus.SUCCEEDED;
      embedJob.finishedAt = new Date();
      await jobRepo.save(embedJob);

      source.status = SourceStatus.PROCESSING;
      await sourceRepo.save(source);

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const existingCount = await embeddingRepo.count({ where: { sourceId } });
      const retryableQuota =
        /429|quota|rate limit/i.test(message) && existingCount > 0;

      embedJob.status = ProcessingJobStatus.FAILED;
      embedJob.errorMessage = message;
      embedJob.finishedAt = new Date();
      await jobRepo.save(embedJob);

      if (retryableQuota) {
        // Keep search usable: do not fail the whole source when embeddings already exist.
        source.status = SourceStatus.READY;
        await sourceRepo.save(source);
        logger.warn(
          { sourceId, existingCount, err: message.slice(0, 240) },
          'Embedding refresh hit provider quota; keeping existing embeddings',
        );
        return {
          sourceId,
          transcriptionId: transcription.id,
          chunkCount: chunks.length,
          embeddedCount: 0,
          skippedCount: existingCount,
          provider: this.provider.name,
          model: this.provider.model,
          dimension: this.provider.dimension ?? null,
        };
      }

      source.status = SourceStatus.FAILED;
      await sourceRepo.save(source);

      throw error;
    }
  }
}

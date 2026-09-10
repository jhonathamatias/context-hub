import type { FastifyBaseLogger } from 'fastify';
import { Inject, Service, Token } from 'typedi';
import {
  DatabaseService,
  KnowledgeExtraction,
  KnowledgeExtractionStatus,
  ProcessingJob,
  ProcessingJobStatus,
  ProcessingStage,
  Source,
  SourceStatus,
  TranscriptChunk,
  Transcription,
  TranscriptionStatus,
} from '../database';
import { withProcessingLog } from '../observability';
import type { TranscriptionSegment } from '../transcription/types';
import { buildTranscriptChunks } from './chunking';
import type { KnowledgeExtractionProvider } from './types';

export const KNOWLEDGE_EXTRACTION_PROVIDER =
  new Token<KnowledgeExtractionProvider>('KnowledgeExtractionProvider');

export type ProcessKnowledgeResult = {
  sourceId: string;
  transcriptionId: string;
  chunkCount: number;
  knowledgeExtractionId: string;
  knowledgeStatus: KnowledgeExtractionStatus;
  suggestedTitle: string | null;
  summary: string | null;
  knowledge: Record<string, unknown> | null;
  warning?: string;
};

@Service()
export class KnowledgeService {
  constructor(
    private readonly database: DatabaseService,
    @Inject(KNOWLEDGE_EXTRACTION_PROVIDER)
    private readonly provider: KnowledgeExtractionProvider,
  ) {}

  async processSource(
    sourceId: string,
    logger: FastifyBaseLogger,
  ): Promise<ProcessKnowledgeResult> {
    const sourceRepo = this.database.getRepository(Source);
    const transcriptionRepo = this.database.getRepository(Transcription);
    const chunkRepo = this.database.getRepository(TranscriptChunk);
    const knowledgeRepo = this.database.getRepository(KnowledgeExtraction);
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

    if (!transcription?.fullText || !transcription.segmentsJson) {
      const error = new Error(
        `Completed transcription not found for source ${sourceId}`,
      );
      (error as Error & { statusCode?: number }).statusCode = 409;
      throw error;
    }

    const existingKnowledge = await knowledgeRepo.findOne({
      where: {
        transcriptionId: transcription.id,
        status: KnowledgeExtractionStatus.COMPLETED,
      },
      order: { createdAt: 'DESC' },
    });
    const existingChunkCount = await chunkRepo.count({
      where: { transcriptionId: transcription.id },
    });
    if (existingKnowledge && existingChunkCount > 0) {
      logger.info(
        {
          sourceId,
          knowledgeExtractionId: existingKnowledge.id,
          chunkCount: existingChunkCount,
        },
        'Knowledge already extracted; skipping re-run',
      );
      return {
        sourceId,
        transcriptionId: transcription.id,
        chunkCount: existingChunkCount,
        knowledgeExtractionId: existingKnowledge.id,
        knowledgeStatus: existingKnowledge.status,
        suggestedTitle: existingKnowledge.suggestedTitle,
        summary: existingKnowledge.summary,
        knowledge: existingKnowledge.payloadJson,
      };
    }

    const segments = transcription.segmentsJson as TranscriptionSegment[];

    source.status = SourceStatus.PROCESSING;
    await sourceRepo.save(source);

    const existingChunks = await chunkRepo.find({
      where: { transcriptionId: transcription.id },
      order: { chunkIndex: 'ASC' },
    });

    let drafts: Awaited<ReturnType<typeof buildTranscriptChunks>>;

    if (existingChunks.length > 0) {
      // Reuse chunks on knowledge retry so embeddings stay valid (no Gemini re-embed).
      drafts = existingChunks.map((chunk) => ({
        chunkIndex: chunk.chunkIndex,
        startSeconds: Number(chunk.startSeconds),
        endSeconds: Number(chunk.endSeconds),
        text: chunk.text,
        normalizedText: chunk.normalizedText,
      }));
      logger.info(
        {
          sourceId,
          transcriptionId: transcription.id,
          chunkCount: drafts.length,
        },
        'Reusing existing transcript chunks for knowledge extraction',
      );
    } else {
      const chunkJob = jobRepo.create({
        sourceId,
        stage: ProcessingStage.CHUNK,
        status: ProcessingJobStatus.RUNNING,
        startedAt: new Date(),
        finishedAt: null,
        errorMessage: null,
      });
      await jobRepo.save(chunkJob);

      try {
        drafts = await withProcessingLog(
          logger,
          ProcessingStage.CHUNK,
          { sourceId, transcriptionId: transcription.id },
          async () => buildTranscriptChunks(segments),
        );

        if (drafts.length === 0) {
          throw new Error('No chunks could be built from transcription segments');
        }

        await chunkRepo.save(
          drafts.map((draft) =>
            chunkRepo.create({
              sourceId,
              transcriptionId: transcription.id,
              chunkIndex: draft.chunkIndex,
              text: draft.text,
              normalizedText: draft.normalizedText,
              startSeconds: draft.startSeconds,
              endSeconds: draft.endSeconds,
            }),
          ),
        );

        chunkJob.status = ProcessingJobStatus.SUCCEEDED;
        chunkJob.finishedAt = new Date();
        await jobRepo.save(chunkJob);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        chunkJob.status = ProcessingJobStatus.FAILED;
        chunkJob.errorMessage = message;
        chunkJob.finishedAt = new Date();
        await jobRepo.save(chunkJob);
        source.status = SourceStatus.FAILED;
        await sourceRepo.save(source);
        throw error;
      }
    }

    const attempt =
      (await knowledgeRepo.count({ where: { sourceId } })) + 1;

    const knowledge = knowledgeRepo.create({
      sourceId,
      transcriptionId: transcription.id,
      provider: this.provider.name,
      status: KnowledgeExtractionStatus.PROCESSING,
      suggestedTitle: null,
      summary: null,
      payloadJson: null,
      errorMessage: null,
      attempt,
      startedAt: new Date(),
      finishedAt: null,
    });
    await knowledgeRepo.save(knowledge);

    const extractJob = jobRepo.create({
      sourceId,
      stage: ProcessingStage.EXTRACT_KNOWLEDGE,
      status: ProcessingJobStatus.RUNNING,
      startedAt: new Date(),
      finishedAt: null,
      errorMessage: null,
    });
    await jobRepo.save(extractJob);

    try {
      const extracted = await withProcessingLog(
        logger,
        ProcessingStage.EXTRACT_KNOWLEDGE,
        {
          sourceId,
          transcriptionId: transcription.id,
          provider: this.provider.name,
          attempt,
        },
        async () =>
          this.provider.extract({
            sourceId,
            language: transcription.language,
            fullText: transcription.fullText!,
            segments,
            chunks: drafts,
          }),
      );

      knowledge.status = KnowledgeExtractionStatus.COMPLETED;
      knowledge.suggestedTitle = extracted.suggestedTitle;
      knowledge.summary = extracted.summary;
      knowledge.payloadJson = extracted as unknown as Record<string, unknown>;
      knowledge.finishedAt = new Date();
      await knowledgeRepo.save(knowledge);

      extractJob.status = ProcessingJobStatus.SUCCEEDED;
      extractJob.finishedAt = new Date();
      await jobRepo.save(extractJob);

      source.status = SourceStatus.PROCESSING;
      await sourceRepo.save(source);

      return {
        sourceId,
        transcriptionId: transcription.id,
        chunkCount: drafts.length,
        knowledgeExtractionId: knowledge.id,
        knowledgeStatus: knowledge.status,
        suggestedTitle: knowledge.suggestedTitle,
        summary: knowledge.summary,
        knowledge: knowledge.payloadJson,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      // LLM failure must not destroy transcription or persisted chunks.
      knowledge.status = KnowledgeExtractionStatus.FAILED;
      knowledge.errorMessage = message;
      knowledge.finishedAt = new Date();
      await knowledgeRepo.save(knowledge);

      extractJob.status = ProcessingJobStatus.FAILED;
      extractJob.errorMessage = message;
      extractJob.finishedAt = new Date();
      await jobRepo.save(extractJob);

      source.status = SourceStatus.PROCESSING;
      await sourceRepo.save(source);

      return {
        sourceId,
        transcriptionId: transcription.id,
        chunkCount: drafts.length,
        knowledgeExtractionId: knowledge.id,
        knowledgeStatus: knowledge.status,
        suggestedTitle: null,
        summary: null,
        knowledge: null,
        warning: message,
      };
    }
  }
}

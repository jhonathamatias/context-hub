import type { FastifyBaseLogger } from 'fastify';
import { Container, Service, Token } from 'typedi';
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
import { OpenAiKnowledgeExtractionProvider } from './openai-knowledge.provider';
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
  private readonly database: DatabaseService;
  private readonly provider: KnowledgeExtractionProvider;

  constructor() {
    this.database = Container.get(DatabaseService);
    this.provider = Container.has(KNOWLEDGE_EXTRACTION_PROVIDER)
      ? Container.get(KNOWLEDGE_EXTRACTION_PROVIDER)
      : Container.get(OpenAiKnowledgeExtractionProvider);
  }

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

    const segments = transcription.segmentsJson as TranscriptionSegment[];

    source.status = SourceStatus.PROCESSING;
    await sourceRepo.save(source);

    const chunkJob = jobRepo.create({
      sourceId,
      stage: ProcessingStage.CHUNK,
      status: ProcessingJobStatus.RUNNING,
      startedAt: new Date(),
      finishedAt: null,
      errorMessage: null,
    });
    await jobRepo.save(chunkJob);

    let drafts;
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

      await chunkRepo.delete({ transcriptionId: transcription.id });
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

      source.status = SourceStatus.READY;
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

      source.status = SourceStatus.READY;
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

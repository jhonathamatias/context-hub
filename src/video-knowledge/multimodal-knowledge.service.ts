import { access } from 'node:fs/promises';
import { join } from 'node:path';
import type { FastifyBaseLogger } from 'fastify';
import { Inject, Service } from 'typedi';
import { env } from '../config/env';
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
import { knowledgeToSyntheticChunks, knowledgeToSyntheticSegments } from './synthetic-chunks';
import {
  VIDEO_KNOWLEDGE_PROVIDER,
  type VideoKnowledgeProvider,
} from './types';

function guessVideoMime(originalName: string): string {
  const lower = originalName.toLowerCase();
  if (lower.endsWith('.webm')) return 'video/webm';
  if (lower.endsWith('.mov')) return 'video/quicktime';
  if (lower.endsWith('.mkv')) return 'video/x-matroska';
  return 'video/mp4';
}

export type ProcessMultimodalResult = {
  sourceId: string;
  transcriptionId: string;
  knowledgeExtractionId: string;
  chunkCount: number;
  suggestedTitle: string | null;
  summary: string | null;
};

/**
 * Multimodal POC orchestrator: video → VideoKnowledgeProvider → domain knowledge
 * + synthetic transcription/chunks for existing embeddings/index.
 */
@Service()
export class MultimodalKnowledgeService {
  constructor(
    private readonly database: DatabaseService,
    @Inject(VIDEO_KNOWLEDGE_PROVIDER)
    private readonly provider: VideoKnowledgeProvider,
  ) {}

  async processSource(
    sourceId: string,
    logger: FastifyBaseLogger,
  ): Promise<ProcessMultimodalResult> {
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

    const videoPath = join(env.storageDir, source.storageKey);
    try {
      await access(videoPath);
    } catch {
      const error = new Error(`Video file not found for source: ${sourceId}`);
      (error as Error & { statusCode?: number }).statusCode = 404;
      throw error;
    }

    source.status = SourceStatus.PROCESSING;
    await sourceRepo.save(source);

    const attempt =
      (await knowledgeRepo.count({ where: { sourceId } })) + 1;

    const transcription = transcriptionRepo.create({
      sourceId,
      provider: this.provider.name,
      status: TranscriptionStatus.PROCESSING,
      language: env.whisper.language ?? 'pt',
      fullText: null,
      segmentsJson: null,
      rawPath: null,
      structuredPath: null,
      errorMessage: null,
      attempt,
      startedAt: new Date(),
      finishedAt: null,
    });
    await transcriptionRepo.save(transcription);

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
          provider: this.provider.name,
          pipeline: 'multimodal',
          attempt,
        },
        async () =>
          this.provider.analyze({
            sourceId,
            videoPath,
            originalName: source.originalName,
            mimeType: guessVideoMime(source.originalName),
          }),
      );

      const segments = knowledgeToSyntheticSegments(extracted);
      const drafts = knowledgeToSyntheticChunks(extracted);

      transcription.status = TranscriptionStatus.COMPLETED;
      transcription.fullText = [
        extracted.suggestedTitle,
        extracted.summary,
        ...segments.map((s) => s.text),
      ].join('\n\n');
      transcription.segmentsJson = segments;
      transcription.finishedAt = new Date();
      await transcriptionRepo.save(transcription);

      // Replace any previous chunks for this source so embeddings target multimodal.
      await chunkRepo.delete({ sourceId });
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

      logger.info(
        {
          sourceId,
          provider: this.provider.name,
          chunkCount: drafts.length,
          suggestedTitle: extracted.suggestedTitle,
        },
        'Multimodal knowledge extraction completed',
      );

      return {
        sourceId,
        transcriptionId: transcription.id,
        knowledgeExtractionId: knowledge.id,
        chunkCount: drafts.length,
        suggestedTitle: knowledge.suggestedTitle,
        summary: knowledge.summary,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      transcription.status = TranscriptionStatus.FAILED;
      transcription.errorMessage = message;
      transcription.finishedAt = new Date();
      await transcriptionRepo.save(transcription);

      knowledge.status = KnowledgeExtractionStatus.FAILED;
      knowledge.errorMessage = message;
      knowledge.finishedAt = new Date();
      await knowledgeRepo.save(knowledge);

      extractJob.status = ProcessingJobStatus.FAILED;
      extractJob.errorMessage = message;
      extractJob.finishedAt = new Date();
      await jobRepo.save(extractJob);

      source.status = SourceStatus.FAILED;
      await sourceRepo.save(source);

      logger.error(
        { sourceId, provider: this.provider.name, err: message.slice(0, 400) },
        'Multimodal knowledge extraction failed',
      );
      throw error;
    }
  }
}

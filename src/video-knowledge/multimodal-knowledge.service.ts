import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { UnrecoverableError } from 'bullmq';
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
import type { JobExecutionContext } from '../jobs/source-job-handler';
import { withProcessingLog } from '../observability';
import {
  multimodalTotalAttempts,
  resolveMultimodalModel,
  willRetryMultimodalAttempt,
} from './multimodal-attempts';
import {
  classifyVideoProviderError,
  publicMessageForAttempt,
} from './provider-error';
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
 *
 * Transient provider errors are rethrown for BullMQ backoff; permanent errors
 * become UnrecoverableError so the queue does not keep retrying.
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
    context?: JobExecutionContext,
  ): Promise<ProcessMultimodalResult> {
    const sourceRepo = this.database.getRepository(Source);
    const transcriptionRepo = this.database.getRepository(Transcription);
    const chunkRepo = this.database.getRepository(TranscriptChunk);
    const knowledgeRepo = this.database.getRepository(KnowledgeExtraction);
    const jobRepo = this.database.getRepository(ProcessingJob);

    const attempt = context?.attempt ?? 1;
    const maxAttempts = context?.maxAttempts ?? multimodalTotalAttempts();
    const { model, isFallback } = resolveMultimodalModel(attempt);

    const source = await sourceRepo.findOne({ where: { id: sourceId } });
    if (!source) {
      const error = new Error(`Source not found: ${sourceId}`);
      (error as Error & { statusCode?: number }).statusCode = 404;
      throw new UnrecoverableError(error.message);
    }

    const videoPath = join(env.storageDir, source.storageKey);
    try {
      await access(videoPath);
    } catch {
      throw new UnrecoverableError(
        `Video file not found for source: ${sourceId}`,
      );
    }

    source.status = SourceStatus.PROCESSING;
    await sourceRepo.save(source);

    const dbAttempt =
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
      attempt: dbAttempt,
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
      attempt: dbAttempt,
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
          model,
          isFallback,
          attempt,
          maxAttempts,
        },
        async () =>
          this.provider.analyze({
            sourceId,
            videoPath,
            originalName: source.originalName,
            mimeType: guessVideoMime(source.originalName),
            model,
            onTelemetry: (event) => {
              logger.info(
                {
                  sourceId: event.sourceId,
                  provider: event.provider,
                  model: event.model,
                  processingMode: event.processingMode,
                  mediaResolution: event.mediaResolution,
                  durationMs: event.durationMs,
                  fileReuse: event.fileReuse,
                  inputTokens: event.inputTokens ?? null,
                  outputTokens: event.outputTokens ?? null,
                  totalTokens: event.totalTokens ?? null,
                  attempt,
                  maxAttempts,
                },
                'Video knowledge analysis telemetry',
              );
            },
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
          model,
          isFallback,
          attempt,
          maxAttempts,
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
      const classified = classifyVideoProviderError(error);
      const willRetry =
        classified.retryable &&
        willRetryMultimodalAttempt(attempt, maxAttempts);
      const publicMessage = publicMessageForAttempt(classified, willRetry);

      transcription.status = TranscriptionStatus.FAILED;
      transcription.errorMessage = publicMessage;
      transcription.finishedAt = new Date();
      await transcriptionRepo.save(transcription);

      knowledge.status = KnowledgeExtractionStatus.FAILED;
      knowledge.errorMessage = publicMessage;
      knowledge.finishedAt = new Date();
      await knowledgeRepo.save(knowledge);

      extractJob.status = ProcessingJobStatus.FAILED;
      extractJob.errorMessage = publicMessage;
      extractJob.finishedAt = new Date();
      await jobRepo.save(extractJob);

      // Keep source PROCESSING while BullMQ still has retries left.
      source.status = willRetry ? SourceStatus.PROCESSING : SourceStatus.FAILED;
      await sourceRepo.save(source);

      logger.error(
        {
          sourceId,
          provider: this.provider.name,
          model,
          isFallback,
          attempt,
          maxAttempts,
          category: classified.category,
          retryable: classified.retryable,
          willRetry,
          status: classified.status,
          err: publicMessage,
        },
        'Multimodal knowledge extraction failed',
      );

      if (!classified.retryable) {
        throw new UnrecoverableError(publicMessage);
      }
      // Retryable: let BullMQ delay/retry. Preserve status on the error when present.
      throw error;
    }
  }
}

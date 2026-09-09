import { access, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { FastifyBaseLogger } from 'fastify';
import { Inject, Service, Token } from 'typedi';
import { env } from '../config/env';
import {
  DatabaseService,
  ProcessingJob,
  ProcessingJobStatus,
  ProcessingStage,
  Source,
  SourceStatus,
  Transcription,
  TranscriptionStatus,
} from '../database';
import { withProcessingLog } from '../observability';
import type { TranscriptionProvider, TranscriptionResult } from './types';

export const TRANSCRIPTION_PROVIDER = new Token<TranscriptionProvider>(
  'TranscriptionProvider',
);

export type TranscribeSourceResult = {
  transcriptionId: string;
  sourceId: string;
  status: TranscriptionStatus;
  provider: string;
  attempt: number;
  language: string | null;
  fullText: string | null;
  segments: TranscriptionResult['segments'];
  rawPath: string | null;
  structuredPath: string | null;
};

@Service()
export class TranscriptionService {
  constructor(
    private readonly database: DatabaseService,
    @Inject(TRANSCRIPTION_PROVIDER)
    private readonly provider: TranscriptionProvider,
  ) {}

  async transcribeSource(
    sourceId: string,
    logger: FastifyBaseLogger,
  ): Promise<TranscribeSourceResult> {
    const sourceRepo = this.database.getRepository(Source);
    const transcriptionRepo = this.database.getRepository(Transcription);
    const jobRepo = this.database.getRepository(ProcessingJob);

    const source = await sourceRepo.findOne({ where: { id: sourceId } });
    if (!source) {
      const error = new Error(`Source not found: ${sourceId}`);
      (error as Error & { statusCode?: number }).statusCode = 404;
      throw error;
    }

    const audioPath = join(env.storageDir, 'sources', source.id, 'audio.wav');
    try {
      await access(audioPath);
    } catch {
      const error = new Error(
        `Audio artifact not found for source ${sourceId}. Run video ingest first.`,
      );
      (error as Error & { statusCode?: number }).statusCode = 409;
      throw error;
    }

    const existingCompleted = await transcriptionRepo.findOne({
      where: {
        sourceId: source.id,
        status: TranscriptionStatus.COMPLETED,
      },
      order: { createdAt: 'DESC' },
    });
    if (existingCompleted) {
      logger.info(
        { sourceId, transcriptionId: existingCompleted.id },
        'Transcription already completed; skipping re-run',
      );
      return {
        transcriptionId: existingCompleted.id,
        sourceId: source.id,
        status: existingCompleted.status,
        provider: existingCompleted.provider,
        attempt: existingCompleted.attempt,
        language: existingCompleted.language,
        fullText: existingCompleted.fullText,
        segments: existingCompleted.segmentsJson ?? [],
        rawPath: existingCompleted.rawPath,
        structuredPath: existingCompleted.structuredPath,
      };
    }

    const previousAttempts = await transcriptionRepo.count({
      where: { sourceId: source.id },
    });
    const attempt = previousAttempts + 1;

    const transcription = transcriptionRepo.create({
      sourceId: source.id,
      provider: this.provider.name,
      status: TranscriptionStatus.PROCESSING,
      language: null,
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

    const job = jobRepo.create({
      sourceId: source.id,
      stage: ProcessingStage.TRANSCRIBE,
      status: ProcessingJobStatus.RUNNING,
      startedAt: new Date(),
      errorMessage: null,
      finishedAt: null,
    });
    await jobRepo.save(job);

    source.status = SourceStatus.PROCESSING;
    await sourceRepo.save(source);

    const sourceDir = join(env.storageDir, 'sources', source.id);
    const workDir = join(env.tempDir, `transcribe-${transcription.id}`);

    try {
      await mkdir(sourceDir, { recursive: true });

      const result = await withProcessingLog(
        logger,
        ProcessingStage.TRANSCRIBE,
        {
          sourceId: source.id,
          provider: this.provider.name,
          attempt,
        },
        async () =>
          this.provider.transcribe({
            audioPath,
            workDir,
          }),
      );

      const rawRelativePath = join(
        'sources',
        source.id,
        'transcription.raw.json',
      );
      const structuredRelativePath = join(
        'sources',
        source.id,
        'transcription.json',
      );

      const structuredPayload = {
        language: result.language,
        fullText: result.fullText,
        segments: result.segments,
      };

      await writeFile(
        join(env.storageDir, rawRelativePath),
        JSON.stringify(result.raw, null, 2),
        'utf8',
      );
      await writeFile(
        join(env.storageDir, structuredRelativePath),
        JSON.stringify(structuredPayload, null, 2),
        'utf8',
      );

      transcription.status = TranscriptionStatus.COMPLETED;
      transcription.language = result.language;
      transcription.fullText = result.fullText;
      transcription.segmentsJson = result.segments;
      transcription.rawPath = rawRelativePath;
      transcription.structuredPath = structuredRelativePath;
      transcription.finishedAt = new Date();
      await transcriptionRepo.save(transcription);

      job.status = ProcessingJobStatus.SUCCEEDED;
      job.finishedAt = new Date();
      await jobRepo.save(job);

      source.status = SourceStatus.PROCESSING;
      await sourceRepo.save(source);

      return {
        transcriptionId: transcription.id,
        sourceId: source.id,
        status: transcription.status,
        provider: transcription.provider,
        attempt: transcription.attempt,
        language: transcription.language,
        fullText: transcription.fullText,
        segments: result.segments,
        rawPath: transcription.rawPath,
        structuredPath: transcription.structuredPath,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      transcription.status = TranscriptionStatus.FAILED;
      transcription.errorMessage = message;
      transcription.finishedAt = new Date();
      await transcriptionRepo.save(transcription);

      job.status = ProcessingJobStatus.FAILED;
      job.errorMessage = message;
      job.finishedAt = new Date();
      await jobRepo.save(job);

      source.status = SourceStatus.FAILED;
      await sourceRepo.save(source);

      throw error;
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  }
}

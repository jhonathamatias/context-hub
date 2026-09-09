import { createWriteStream } from 'node:fs';
import { mkdir, mkdtemp, rename, rm } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { Readable } from 'node:stream';
import type { FastifyBaseLogger } from 'fastify';
import { Service } from 'typedi';
import { env } from '../config/env';
import {
  DatabaseService,
  ProcessingJob,
  ProcessingJobStatus,
  ProcessingStage,
  Source,
  SourceStatus,
  SourceType,
} from '../database';
import { withProcessingLog } from '../observability';
import { FfmpegVideoProcessor } from './ffmpeg-video-processor';
import {
  VideoValidationError,
  assertVideoFile,
  normalizeExtension,
} from './file-validation';
import type { VideoMetadata } from './types';

const ALLOWED_EXTENSIONS = ['mp4', 'mov', 'webm', 'mkv'];

export type IngestVideoInput = {
  filename: string;
  mimetype: string;
  fileStream: Readable;
  logger: FastifyBaseLogger;
};

export type IngestVideoResult = {
  sourceId: string;
  jobId: string;
  originalName: string;
  storageKey: string;
  audioPath: string;
  status: SourceStatus;
  metadata: VideoMetadata;
};

@Service()
export class SourceIngestService {
  constructor(
    private readonly database: DatabaseService,
    private readonly videoProcessor: FfmpegVideoProcessor,
  ) {}

  async ingest(input: IngestVideoInput): Promise<IngestVideoResult> {
    const extension = normalizeExtension(input.filename);
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      throw new VideoValidationError(
        `Unsupported video format ".${extension}". Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`,
      );
    }

    const sourceRepo = this.database.getRepository(Source);
    const jobRepo = this.database.getRepository(ProcessingJob);

    const source = sourceRepo.create({
      type: SourceType.VIDEO,
      originalName: basename(input.filename),
      storageKey: 'pending',
      status: SourceStatus.PENDING,
    });
    await sourceRepo.save(source);

    const sourceDir = join(env.storageDir, 'sources', source.id);
    source.storageKey = join('sources', source.id, `original.${extension}`);
    await sourceRepo.save(source);

    const originalPath = join(env.storageDir, source.storageKey);

    const ingestJob = jobRepo.create({
      sourceId: source.id,
      stage: ProcessingStage.INGEST,
      status: ProcessingJobStatus.RUNNING,
      startedAt: new Date(),
      errorMessage: null,
      finishedAt: null,
    });
    await jobRepo.save(ingestJob);

    const workDir = await mkdtemp(join(env.tempDir, 'ingest-'));

    try {
      await mkdir(sourceDir, { recursive: true });
      await pipeline(input.fileStream, createWriteStream(originalPath));

      await assertVideoFile(originalPath, input.filename, {
        maxBytes: env.maxUploadBytes,
        allowedExtensions: ALLOWED_EXTENSIONS,
      });

      ingestJob.status = ProcessingJobStatus.SUCCEEDED;
      ingestJob.finishedAt = new Date();
      await jobRepo.save(ingestJob);

      const extractJob = jobRepo.create({
        sourceId: source.id,
        stage: ProcessingStage.EXTRACT_AUDIO,
        status: ProcessingJobStatus.RUNNING,
        startedAt: new Date(),
        errorMessage: null,
        finishedAt: null,
      });
      await jobRepo.save(extractJob);

      source.status = SourceStatus.PROCESSING;
      await sourceRepo.save(source);

      const processed = await withProcessingLog(
        input.logger,
        ProcessingStage.EXTRACT_AUDIO,
        {
          sourceId: source.id,
          originalName: source.originalName,
        },
        async () =>
          this.videoProcessor.process(originalPath, workDir, {
            maxBytes: env.maxUploadBytes,
            allowedExtensions: ALLOWED_EXTENSIONS,
          }),
      );

      const audioDestination = join(sourceDir, 'audio.wav');
      await rename(processed.audioPath, audioDestination);

      extractJob.status = ProcessingJobStatus.SUCCEEDED;
      extractJob.finishedAt = new Date();
      await jobRepo.save(extractJob);

      source.status = SourceStatus.READY;
      await sourceRepo.save(source);

      return {
        sourceId: source.id,
        jobId: extractJob.id,
        originalName: source.originalName,
        storageKey: source.storageKey,
        audioPath: join('sources', source.id, 'audio.wav'),
        status: source.status,
        metadata: processed.metadata,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      source.status = SourceStatus.FAILED;
      await sourceRepo.save(source);

      const runningJobs = await jobRepo.find({
        where: {
          sourceId: source.id,
          status: ProcessingJobStatus.RUNNING,
        },
      });

      for (const job of runningJobs) {
        job.status = ProcessingJobStatus.FAILED;
        job.errorMessage = message;
        job.finishedAt = new Date();
        await jobRepo.save(job);
      }

      throw error;
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  }
}

export function getAllowedVideoExtensions(): string[] {
  return [...ALLOWED_EXTENSIONS];
}

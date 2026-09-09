import { copyFile, mkdir, mkdtemp, rename, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { FastifyBaseLogger } from 'fastify';
import { Service } from 'typedi';
import type {
  CollectedSourceItem,
  LocalFilesystemInput,
  LocalUploadInput,
} from '../connectors';
import {
  LocalFilesystemVideoConnector,
  LocalUploadVideoConnector,
} from '../connectors';
import { env } from '../config/env';
import {
  DatabaseService,
  ProcessingJob,
  ProcessingJobStatus,
  ProcessingStage,
  Source,
  SourceStatus,
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

export type IngestVideoInput = LocalUploadInput & {
  logger: FastifyBaseLogger;
};

export type IngestVideoResult = {
  sourceId: string;
  jobId: string;
  connectorKind: string;
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
    private readonly localUploadConnector: LocalUploadVideoConnector,
    private readonly localFilesystemConnector: LocalFilesystemVideoConnector,
  ) {}

  /** HTTP multipart upload — goes through the local-upload connector. */
  async ingest(input: IngestVideoInput): Promise<IngestVideoResult> {
    const [item] = await this.localUploadConnector.collect(
      {
        filename: input.filename,
        mimetype: input.mimetype,
        fileStream: input.fileStream,
      },
      { logger: input.logger },
    );

    if (!item) {
      throw new Error('Upload connector returned no items');
    }

    return this.ingestCollected(item, input.logger);
  }

  /** Absolute path on the API host — goes through the filesystem connector. */
  async ingestFromFilesystem(
    input: LocalFilesystemInput,
    logger: FastifyBaseLogger,
  ): Promise<IngestVideoResult> {
    const [item] = await this.localFilesystemConnector.collect(input, {
      logger,
    });

    if (!item) {
      throw new Error('Filesystem connector returned no items');
    }

    return this.ingestCollected(item, logger);
  }

  /**
   * Central pipeline entry: any connector that yields a collected video item
   * can call this without changing ingest/extract logic.
   */
  async ingestCollected(
    item: CollectedSourceItem,
    logger: FastifyBaseLogger,
  ): Promise<IngestVideoResult> {
    const extension = normalizeExtension(item.originalName);
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      throw new VideoValidationError(
        `Unsupported video format ".${extension}". Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`,
      );
    }

    const sourceRepo = this.database.getRepository(Source);
    const jobRepo = this.database.getRepository(ProcessingJob);

    const source = sourceRepo.create({
      type: item.sourceType,
      originalName: item.originalName,
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
      await copyFile(item.contentPath, originalPath);

      await assertVideoFile(originalPath, item.originalName, {
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
        logger,
        ProcessingStage.EXTRACT_AUDIO,
        {
          sourceId: source.id,
          originalName: source.originalName,
          connectorKind: item.connectorKind,
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
        connectorKind: item.connectorKind,
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
      if (item.ephemeral) {
        await rm(dirname(item.contentPath), { recursive: true, force: true });
      }
    }
  }
}

export function getAllowedVideoExtensions(): string[] {
  return [...ALLOWED_EXTENSIONS];
}

import { access, copyFile, mkdir, mkdtemp, rename, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { FastifyBaseLogger } from 'fastify';
import { Service } from 'typedi';
import type {
  CollectedSourceItem,
  LocalFilesystemInput,
  LocalUploadInput,
  OneDriveInput,
} from '../connectors';
import {
  LocalFilesystemVideoConnector,
  LocalUploadVideoConnector,
  OneDriveVideoConnector,
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
import { ProcessingStateService } from '../processing';
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

/** Fast HTTP accept — file on disk, extract deferred to worker. */
export type AcceptIngestResult = {
  sourceId: string;
  jobId: string;
  connectorKind: string;
  originalName: string;
  status: SourceStatus;
  queuedJob: 'video.extract';
};

export type ExtractAudioResult = {
  sourceId: string;
  jobId: string;
  status: SourceStatus;
  skipped: boolean;
  metadata: VideoMetadata | null;
};

@Service()
export class SourceIngestService {
  constructor(
    private readonly database: DatabaseService,
    private readonly state: ProcessingStateService,
    private readonly videoProcessor: FfmpegVideoProcessor,
    private readonly localUploadConnector: LocalUploadVideoConnector,
    private readonly localFilesystemConnector: LocalFilesystemVideoConnector,
    private readonly oneDriveConnector: OneDriveVideoConnector,
  ) {}

  async acceptUpload(input: IngestVideoInput): Promise<AcceptIngestResult> {
    const item = await this.collectOne(
      () =>
        this.localUploadConnector.collect(
          {
            filename: input.filename,
            mimetype: input.mimetype,
            fileStream: input.fileStream,
          },
          { logger: input.logger },
        ),
      'Upload connector returned no items',
    );
    return this.acceptCollected(item, input.logger);
  }

  async acceptFromFilesystem(
    input: LocalFilesystemInput,
    logger: FastifyBaseLogger,
  ): Promise<AcceptIngestResult> {
    const item = await this.collectOne(
      () => this.localFilesystemConnector.collect(input, { logger }),
      'Filesystem connector returned no items',
    );
    return this.acceptCollected(item, logger);
  }

  async previewOneDrive(
    input: Pick<OneDriveInput, 'shareUrl' | 'accessToken'>,
    logger: FastifyBaseLogger,
  ) {
    return this.oneDriveConnector.listVideos(input.shareUrl, {
      ...(input.accessToken ? { accessToken: input.accessToken } : {}),
      logger,
    });
  }

  async acceptFromOneDrive(
    input: OneDriveInput,
    logger: FastifyBaseLogger,
  ): Promise<AcceptIngestResult[]> {
    const items = await this.oneDriveConnector.collect(input, { logger });
    if (items.length === 0) {
      throw new VideoValidationError('OneDrive connector returned no items');
    }
    const accepted: AcceptIngestResult[] = [];
    for (const item of items) {
      accepted.push(await this.acceptCollected(item, logger));
    }
    return accepted;
  }

  /** Persist collected video + INGEST job. ffmpeg runs in `extractAudio`. */
  async acceptCollected(
    item: CollectedSourceItem,
    logger: FastifyBaseLogger,
  ): Promise<AcceptIngestResult> {
    const extension = this.requireExtension(item.originalName);
    const source = await this.createSourceShell(item, extension);
    const ingestJob = await this.state.createJob(
      source.id,
      ProcessingStage.INGEST,
      ProcessingJobStatus.RUNNING,
    );

    try {
      await this.persistOriginalFile(item, source);
      await this.state.markSucceeded(ingestJob);

      const extractJob = await this.state.createJob(
        source.id,
        ProcessingStage.EXTRACT_AUDIO,
        ProcessingJobStatus.PENDING,
      );
      await this.state.setSourceStatus(source, SourceStatus.PROCESSING);

      logger.info(
        { sourceId: source.id, jobId: extractJob.id },
        'Source accepted; video.extract pending',
      );

      return {
        sourceId: source.id,
        jobId: extractJob.id,
        connectorKind: item.connectorKind,
        originalName: source.originalName,
        status: source.status,
        queuedJob: 'video.extract',
      };
    } catch (error) {
      await this.state.setSourceStatus(source, SourceStatus.FAILED);
      await this.state.markFailed(ingestJob, error);
      throw error;
    } finally {
      await this.cleanupEphemeral(item);
    }
  }

  /** Worker entry — idempotent when audio.wav already exists. */
  async extractAudio(
    sourceId: string,
    logger: FastifyBaseLogger,
  ): Promise<ExtractAudioResult> {
    const source = await this.requireSource(sourceId);
    const paths = this.sourcePaths(source);
    const extractJob = await this.resolveExtractJob(sourceId);

    if (await this.pathExists(paths.audio)) {
      return this.skipExtractBecauseAudioExists(source, extractJob);
    }

    const job = await this.claimExtractJob(sourceId, extractJob);
    return this.runFfmpegExtract(source, job, paths, logger);
  }

  private async collectOne(
    collect: () => Promise<CollectedSourceItem[]>,
    emptyMessage: string,
  ): Promise<CollectedSourceItem> {
    const [item] = await collect();
    if (!item) {
      throw new Error(emptyMessage);
    }
    return item;
  }

  private requireExtension(originalName: string): string {
    const extension = normalizeExtension(originalName);
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      throw new VideoValidationError(
        `Unsupported video format ".${extension}". Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`,
      );
    }
    return extension;
  }

  private async createSourceShell(
    item: CollectedSourceItem,
    extension: string,
  ): Promise<Source> {
    const sourceRepo = this.database.getRepository(Source);
    const source = sourceRepo.create({
      type: item.sourceType,
      originalName: item.originalName,
      storageKey: 'pending',
      status: SourceStatus.PENDING,
    });
    await sourceRepo.save(source);
    source.storageKey = join('sources', source.id, `original.${extension}`);
    await sourceRepo.save(source);
    return source;
  }

  private async persistOriginalFile(
    item: CollectedSourceItem,
    source: Source,
  ): Promise<void> {
    const sourceDir = join(env.storageDir, 'sources', source.id);
    const originalPath = join(env.storageDir, source.storageKey);
    await mkdir(sourceDir, { recursive: true });
    await copyFile(item.contentPath, originalPath);
    await assertVideoFile(originalPath, item.originalName, {
      maxBytes: env.maxUploadBytes,
      allowedExtensions: ALLOWED_EXTENSIONS,
    });
  }

  private async cleanupEphemeral(item: CollectedSourceItem): Promise<void> {
    if (!item.ephemeral) {
      return;
    }
    await rm(dirname(item.contentPath), { recursive: true, force: true });
  }

  private async requireSource(sourceId: string): Promise<Source> {
    const source = await this.database.getRepository(Source).findOne({
      where: { id: sourceId },
    });
    if (!source) {
      const error = new Error(`Source not found: ${sourceId}`);
      (error as Error & { statusCode?: number }).statusCode = 404;
      throw error;
    }
    return source;
  }

  private sourcePaths(source: Source): {
    dir: string;
    audio: string;
    original: string;
  } {
    const dir = join(env.storageDir, 'sources', source.id);
    return {
      dir,
      audio: join(dir, 'audio.wav'),
      original: join(env.storageDir, source.storageKey),
    };
  }

  private async pathExists(path: string): Promise<boolean> {
    try {
      await access(path);
      return true;
    } catch {
      return false;
    }
  }

  private async resolveExtractJob(
    sourceId: string,
  ): Promise<ProcessingJob | null> {
    return this.database.getRepository(ProcessingJob).findOne({
      where: {
        sourceId,
        stage: ProcessingStage.EXTRACT_AUDIO,
        status: ProcessingJobStatus.PENDING,
      },
      order: { createdAt: 'DESC' },
    });
  }

  private async skipExtractBecauseAudioExists(
    source: Source,
    extractJob: ProcessingJob | null,
  ): Promise<ExtractAudioResult> {
    let job = extractJob;
    if (!job) {
      job = await this.database.getRepository(ProcessingJob).findOne({
        where: { sourceId: source.id, stage: ProcessingStage.EXTRACT_AUDIO },
        order: { createdAt: 'DESC' },
      });
    }

    if (job && job.status !== ProcessingJobStatus.SUCCEEDED) {
      await this.state.markSucceeded(job);
    }
    // Audio extract is an intermediate step — keep PROCESSING until later stages finish.
    await this.state.setSourceStatus(source, SourceStatus.PROCESSING);

    return {
      sourceId: source.id,
      jobId: job?.id ?? source.id,
      status: source.status,
      skipped: true,
      metadata: null,
    };
  }

  private async claimExtractJob(
    sourceId: string,
    existing: ProcessingJob | null,
  ): Promise<ProcessingJob> {
    const job =
      existing ??
      (await this.state.createJob(
        sourceId,
        ProcessingStage.EXTRACT_AUDIO,
        ProcessingJobStatus.PENDING,
      ));
    await this.state.markRunning(job);
    return job;
  }

  private async runFfmpegExtract(
    source: Source,
    extractJob: ProcessingJob,
    paths: { dir: string; audio: string; original: string },
    logger: FastifyBaseLogger,
  ): Promise<ExtractAudioResult> {
    await this.state.setSourceStatus(source, SourceStatus.PROCESSING);
    const workDir = await mkdtemp(join(env.tempDir, 'extract-'));

    try {
      const processed = await withProcessingLog(
        logger,
        ProcessingStage.EXTRACT_AUDIO,
        { sourceId: source.id, originalName: source.originalName },
        async () =>
          this.videoProcessor.process(paths.original, workDir, {
            maxBytes: env.maxUploadBytes,
            allowedExtensions: ALLOWED_EXTENSIONS,
          }),
      );

      await mkdir(paths.dir, { recursive: true });
      await rename(processed.audioPath, paths.audio);

      await this.state.markSucceeded(extractJob);
      // Not fully ready yet — transcription/knowledge/embeddings still to run.
      await this.state.setSourceStatus(source, SourceStatus.PROCESSING);

      return {
        sourceId: source.id,
        jobId: extractJob.id,
        status: source.status,
        skipped: false,
        metadata: processed.metadata,
      };
    } catch (error) {
      await this.state.markFailed(extractJob, error);
      await this.state.setSourceStatus(source, SourceStatus.FAILED);
      throw error;
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  }
}

export function getAllowedVideoExtensions(): string[] {
  return [...ALLOWED_EXTENSIONS];
}

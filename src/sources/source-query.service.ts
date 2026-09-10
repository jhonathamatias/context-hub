import { access, mkdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { Service } from 'typedi';
import { env } from '../config/env';
import {
  ChunkEmbedding,
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
import { FfmpegVideoProcessor } from '../video/ffmpeg-video-processor';

export type SourceSummary = {
  id: string;
  type: string;
  originalName: string;
  status: SourceStatus;
  videoUrl: string;
  thumbnailUrl: string;
  createdAt: string;
  updatedAt: string;
};

export type SourceListResult = {
  items: SourceSummary[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type PipelineProgress = {
  percent: number;
  stage: string;
  label: string;
  detail: string | null;
  transcriptionPercent: number | null;
  ingestPercent: number | null;
};

export type SourceStatusResult = {
  id: string;
  originalName: string;
  status: SourceStatus;
  videoUrl: string;
  thumbnailUrl: string;
  createdAt: string;
  updatedAt: string;
  pipeline: {
    transcription: {
      status: string | null;
      language: string | null;
      attempt: number | null;
      updatedAt: string | null;
    };
    knowledge: {
      status: string | null;
      suggestedTitle: string | null;
      errorMessage: string | null;
      updatedAt: string | null;
    };
    chunks: { count: number };
    embeddings: { count: number };
    progress: PipelineProgress;
    latestJobs: Array<{
      id: string;
      stage: string;
      status: string;
      errorMessage: string | null;
      startedAt: string | null;
      finishedAt: string | null;
    }>;
  };
};

export type SourceTranscriptResult = {
  sourceId: string;
  transcriptionId: string;
  status: TranscriptionStatus;
  language: string | null;
  fullText: string | null;
  segments: Array<{
    startSeconds: number;
    endSeconds: number;
    text: string;
  }>;
  attempt: number;
  createdAt: string;
  updatedAt: string;
};

export type SourceKnowledgeResult = {
  sourceId: string;
  knowledgeExtractionId: string;
  status: string;
  suggestedTitle: string | null;
  summary: string | null;
  knowledge: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function mediaUrlFor(sourceId: string): string {
  return `/sources/${sourceId}/media`;
}

function thumbnailUrlFor(sourceId: string): string {
  return `/sources/${sourceId}/thumbnail`;
}

function guessVideoMime(originalName: string): string {
  const lower = originalName.toLowerCase();
  if (lower.endsWith('.webm')) return 'video/webm';
  if (lower.endsWith('.mov')) return 'video/quicktime';
  if (lower.endsWith('.mkv')) return 'video/x-matroska';
  return 'video/mp4';
}

function toSourceSummary(source: Source): SourceSummary {
  return {
    id: source.id,
    type: source.type,
    originalName: source.originalName,
    status: source.status,
    videoUrl: mediaUrlFor(source.id),
    thumbnailUrl: thumbnailUrlFor(source.id),
    createdAt: source.createdAt.toISOString(),
    updatedAt: source.updatedAt.toISOString(),
  };
}

export type SourceMediaInfo = {
  absolutePath: string;
  size: number;
  mimeType: string;
  originalName: string;
};

export type SourceThumbnailInfo = {
  absolutePath: string;
  size: number;
  mimeType: string;
};

type WhisperProgressFile = {
  percent?: number;
  positionSeconds?: number;
  durationSeconds?: number | null;
  segments?: number;
  status?: string;
};

type IngestProgressFile = {
  percent?: number;
  bytesReceived?: number;
  bytesTotal?: number | null;
  status?: string;
};

async function readWhisperProgress(
  transcriptionId: string,
): Promise<WhisperProgressFile | null> {
  const path = join(env.tempDir, `transcribe-${transcriptionId}`, 'progress.json');
  try {
    const raw = await readFile(path, 'utf8');
    return JSON.parse(raw) as WhisperProgressFile;
  } catch {
    return null;
  }
}

async function readIngestProgress(
  sourceId: string,
): Promise<IngestProgressFile | null> {
  const path = join(env.storageDir, 'sources', sourceId, 'ingest-progress.json');
  try {
    const raw = await readFile(path, 'utf8');
    return JSON.parse(raw) as IngestProgressFile;
  } catch {
    return null;
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function buildPipelineProgress(input: {
  sourceStatus: SourceStatus;
  transcription: Transcription | null;
  knowledge: KnowledgeExtraction | null;
  embeddingCount: number;
  latestJobs: ProcessingJob[];
  whisper: WhisperProgressFile | null;
  ingest: IngestProgressFile | null;
}): PipelineProgress {
  const {
    sourceStatus,
    transcription,
    knowledge,
    embeddingCount,
    latestJobs,
    whisper,
    ingest,
  } = input;

  if (knowledge?.status === KnowledgeExtractionStatus.PROCESSING) {
    return {
      percent: 90,
      stage: ProcessingStage.EXTRACT_KNOWLEDGE,
      label: 'Extraindo conhecimento',
      detail: 'Gerando resumo e tópicos',
      transcriptionPercent: 100,
      ingestPercent: 100,
    };
  }

  // Search index may exist before knowledge succeeds (soft-fail path).
  // Only treat as fully done when the source is READY or knowledge finished.
  if (
    sourceStatus === SourceStatus.READY ||
    (embeddingCount > 0 &&
      (knowledge?.status === KnowledgeExtractionStatus.COMPLETED ||
        knowledge?.status === KnowledgeExtractionStatus.FAILED))
  ) {
    return {
      percent: 100,
      stage: 'DONE',
      label: 'Processado',
      detail: null,
      transcriptionPercent: 100,
      ingestPercent: 100,
    };
  }

  if (sourceStatus === SourceStatus.FAILED) {
    return {
      percent: 0,
      stage: 'FAILED',
      label: 'Falhou',
      detail: latestJobs.find((j) => j.status === ProcessingJobStatus.FAILED)
        ?.errorMessage ?? null,
      transcriptionPercent: null,
      ingestPercent: null,
    };
  }

  const succeeded = new Set(
    latestJobs
      .filter((j) => j.status === ProcessingJobStatus.SUCCEEDED)
      .map((j) => j.stage),
  );
  const running = latestJobs.find((j) => j.status === ProcessingJobStatus.RUNNING);
  const pendingExtract = latestJobs.find(
    (j) =>
      j.stage === ProcessingStage.EXTRACT_AUDIO &&
      j.status === ProcessingJobStatus.PENDING,
  );

  const ingestDone = succeeded.has(ProcessingStage.INGEST);
  const extractDone = succeeded.has(ProcessingStage.EXTRACT_AUDIO);
  const transcribeDone =
    transcription?.status === TranscriptionStatus.COMPLETED ||
    succeeded.has(ProcessingStage.TRANSCRIBE);
  const knowledgeDone =
    knowledge?.status === KnowledgeExtractionStatus.COMPLETED;

  let base = 0;
  if (ingestDone) base = 8;
  if (extractDone) base = 15;

  if (!extractDone) {
    if (!ingestDone) {
      const ingestPercent =
        typeof ingest?.percent === 'number' ? ingest.percent : null;
      const received = ingest?.bytesReceived;
      const total = ingest?.bytesTotal;
      const detail =
        received != null && total != null && total > 0
          ? `${formatBytes(received)} / ${formatBytes(total)}`
          : received != null
            ? `${formatBytes(received)} baixados`
            : 'Baixando do OneDrive…';
      const overall =
        ingestPercent != null
          ? Math.max(1, Math.min(99, Math.round(ingestPercent)))
          : running?.stage === ProcessingStage.INGEST
            ? 1
            : 0;
      return {
        percent: overall,
        stage: ProcessingStage.INGEST,
        label: 'Importando vídeo',
        detail,
        transcriptionPercent: null,
        ingestPercent: overall,
      };
    }

    const extracting = running?.stage === ProcessingStage.EXTRACT_AUDIO;
    return {
      percent: extracting ? 12 : 8,
      stage: ProcessingStage.EXTRACT_AUDIO,
      label: extracting
        ? 'Extraindo áudio'
        : pendingExtract
          ? 'Na fila · extraindo áudio'
          : 'Preparando vídeo',
      detail: null,
      transcriptionPercent: null,
      ingestPercent: 100,
    };
  }

  if (!transcribeDone) {
    const whisperPercent =
      typeof whisper?.percent === 'number' ? whisper.percent : null;
    const transcribeSlice =
      whisperPercent != null ? (whisperPercent / 100) * 70 : 8;
    const position = whisper?.positionSeconds;
    const duration = whisper?.durationSeconds;
    const detail =
      position != null && duration != null
        ? `${formatClock(position)} / ${formatClock(duration)}`
        : whisperPercent != null
          ? `Transcrição ${Math.round(whisperPercent)}%`
          : 'Transcrevendo com Whisper (pode demorar em vídeos longos)';

    return {
      percent: Math.min(85, Math.round(base + transcribeSlice)),
      stage: ProcessingStage.TRANSCRIBE,
      label: 'Transcrevendo',
      detail,
      transcriptionPercent: whisperPercent,
      ingestPercent: 100,
    };
  }

  if (!knowledgeDone) {
    return {
      percent: 90,
      stage: ProcessingStage.EXTRACT_KNOWLEDGE,
      label: 'Extraindo conhecimento',
      detail: 'Gerando resumo e tópicos',
      transcriptionPercent: 100,
      ingestPercent: 100,
    };
  }

  return {
    percent: 96,
    stage: ProcessingStage.EMBED,
    label: 'Gerando embeddings',
    detail: 'Indexando para busca',
    transcriptionPercent: 100,
    ingestPercent: 100,
  };
}

function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

@Service()
export class SourceQueryService {
  constructor(
    private readonly database: DatabaseService,
    private readonly videoProcessor: FfmpegVideoProcessor,
  ) {}

  async list(input: {
    page: number;
    pageSize: number;
    status?: SourceStatus;
  }): Promise<SourceListResult> {
    const repo = this.database.getRepository(Source);
    const where = input.status ? { status: input.status } : {};
    const [rows, total] = await repo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    });

    return {
      items: rows.map(toSourceSummary),
      page: input.page,
      pageSize: input.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / input.pageSize)),
    };
  }

  async getById(sourceId: string): Promise<SourceSummary> {
    const source = await this.requireSource(sourceId);
    return toSourceSummary(source);
  }

  async resolveMedia(sourceId: string): Promise<SourceMediaInfo> {
    const source = await this.requireSource(sourceId);
    const absolutePath = join(env.storageDir, source.storageKey);
    try {
      await access(absolutePath);
    } catch {
      const error = new Error(`Media file not found for source: ${sourceId}`);
      (error as Error & { statusCode?: number }).statusCode = 404;
      throw error;
    }
    const fileStat = await stat(absolutePath);
    return {
      absolutePath,
      size: fileStat.size,
      mimeType: guessVideoMime(source.originalName),
      originalName: source.originalName,
    };
  }

  async resolveThumbnail(sourceId: string): Promise<SourceThumbnailInfo> {
    const source = await this.requireSource(sourceId);
    const thumbPath = join(
      env.storageDir,
      'sources',
      source.id,
      'thumbnail.jpg',
    );

    try {
      await access(thumbPath);
    } catch {
      const originalPath = join(env.storageDir, source.storageKey);
      try {
        await access(originalPath);
        await mkdir(join(env.storageDir, 'sources', source.id), {
          recursive: true,
        });
        await this.videoProcessor.extractThumbnail(
          originalPath,
          thumbPath,
          1,
        );
      } catch {
        const error = new Error(
          `Thumbnail not available for source: ${sourceId}`,
        );
        (error as Error & { statusCode?: number }).statusCode = 404;
        throw error;
      }
    }

    const fileStat = await stat(thumbPath);
    return {
      absolutePath: thumbPath,
      size: fileStat.size,
      mimeType: 'image/jpeg',
    };
  }

  async getStatus(sourceId: string): Promise<SourceStatusResult> {
    const source = await this.requireSource(sourceId);
    const transcriptionRepo = this.database.getRepository(Transcription);
    const knowledgeRepo = this.database.getRepository(KnowledgeExtraction);
    const chunkRepo = this.database.getRepository(TranscriptChunk);
    const embeddingRepo = this.database.getRepository(ChunkEmbedding);
    const jobRepo = this.database.getRepository(ProcessingJob);

    const [transcription, knowledge, chunkCount, embeddingCount, latestJobs] =
      await Promise.all([
        transcriptionRepo.findOne({
          where: { sourceId },
          order: { createdAt: 'DESC' },
        }),
        knowledgeRepo.findOne({
          where: { sourceId },
          order: { createdAt: 'DESC' },
        }),
        chunkRepo.count({ where: { sourceId } }),
        embeddingRepo.count({ where: { sourceId } }),
        jobRepo.find({
          where: { sourceId },
          order: { createdAt: 'DESC' },
          take: 12,
        }),
      ]);

    const whisper =
      transcription?.status === TranscriptionStatus.PROCESSING
        ? await readWhisperProgress(transcription.id)
        : transcription?.status === TranscriptionStatus.COMPLETED
          ? { percent: 100 }
          : null;

    const ingestSucceeded = latestJobs.some(
      (j) =>
        j.stage === ProcessingStage.INGEST &&
        j.status === ProcessingJobStatus.SUCCEEDED,
    );
    const ingest =
      !ingestSucceeded && source.status === SourceStatus.PROCESSING
        ? await readIngestProgress(sourceId)
        : null;

    const progress = buildPipelineProgress({
      sourceStatus: source.status,
      transcription,
      knowledge,
      embeddingCount,
      latestJobs,
      whisper,
      ingest,
    });

    return {
      id: source.id,
      originalName: source.originalName,
      status: source.status,
      videoUrl: mediaUrlFor(source.id),
      thumbnailUrl: thumbnailUrlFor(source.id),
      createdAt: source.createdAt.toISOString(),
      updatedAt: source.updatedAt.toISOString(),
      pipeline: {
        transcription: {
          status: transcription?.status ?? null,
          language: transcription?.language ?? null,
          attempt: transcription?.attempt ?? null,
          updatedAt: toIso(transcription?.updatedAt),
        },
        knowledge: {
          status: knowledge?.status ?? null,
          suggestedTitle: knowledge?.suggestedTitle ?? null,
          errorMessage: knowledge?.errorMessage ?? null,
          updatedAt: toIso(knowledge?.updatedAt),
        },
        chunks: { count: chunkCount },
        embeddings: { count: embeddingCount },
        progress,
        latestJobs: latestJobs.map((job) => ({
          id: job.id,
          stage: job.stage,
          status: job.status,
          errorMessage: job.errorMessage,
          startedAt: toIso(job.startedAt),
          finishedAt: toIso(job.finishedAt),
        })),
      },
    };
  }

  async getTranscript(sourceId: string): Promise<SourceTranscriptResult> {
    await this.requireSource(sourceId);

    const transcription = await this.database
      .getRepository(Transcription)
      .findOne({
        where: { sourceId, status: TranscriptionStatus.COMPLETED },
        order: { createdAt: 'DESC' },
      });

    if (!transcription) {
      const error = new Error('Completed transcript not found for source');
      (error as Error & { statusCode?: number }).statusCode = 404;
      throw error;
    }

    return {
      sourceId,
      transcriptionId: transcription.id,
      status: transcription.status,
      language: transcription.language,
      fullText: transcription.fullText,
      segments: transcription.segmentsJson ?? [],
      attempt: transcription.attempt,
      createdAt: transcription.createdAt.toISOString(),
      updatedAt: transcription.updatedAt.toISOString(),
    };
  }

  async getKnowledge(sourceId: string): Promise<SourceKnowledgeResult> {
    await this.requireSource(sourceId);

    const knowledge = await this.database
      .getRepository(KnowledgeExtraction)
      .findOne({
        where: { sourceId },
        order: { createdAt: 'DESC' },
      });

    if (!knowledge) {
      const error = new Error('Knowledge extraction not found for source');
      (error as Error & { statusCode?: number }).statusCode = 404;
      throw error;
    }

    return {
      sourceId,
      knowledgeExtractionId: knowledge.id,
      status: knowledge.status,
      suggestedTitle: knowledge.suggestedTitle,
      summary: knowledge.summary,
      knowledge: knowledge.payloadJson,
      createdAt: knowledge.createdAt.toISOString(),
      updatedAt: knowledge.updatedAt.toISOString(),
    };
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
}

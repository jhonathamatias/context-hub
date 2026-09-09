import { Service } from 'typedi';
import {
  ChunkEmbedding,
  DatabaseService,
  KnowledgeExtraction,
  ProcessingJob,
  Source,
  SourceStatus,
  TranscriptChunk,
  Transcription,
  TranscriptionStatus,
} from '../database';

export type SourceSummary = {
  id: string;
  type: string;
  originalName: string;
  status: SourceStatus;
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

export type SourceStatusResult = {
  id: string;
  originalName: string;
  status: SourceStatus;
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
      updatedAt: string | null;
    };
    chunks: { count: number };
    embeddings: { count: number };
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

function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function toSourceSummary(source: Source): SourceSummary {
  return {
    id: source.id,
    type: source.type,
    originalName: source.originalName,
    status: source.status,
    createdAt: source.createdAt.toISOString(),
    updatedAt: source.updatedAt.toISOString(),
  };
}

@Service()
export class SourceQueryService {
  constructor(private readonly database: DatabaseService) {}

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

    return {
      id: source.id,
      originalName: source.originalName,
      status: source.status,
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
          updatedAt: toIso(knowledge?.updatedAt),
        },
        chunks: { count: chunkCount },
        embeddings: { count: embeddingCount },
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

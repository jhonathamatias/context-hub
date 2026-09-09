import type { FastifyBaseLogger } from 'fastify';
import { Service } from 'typedi';
import { EmbeddingsGenerateJobHandler } from './handlers/embeddings-generate.handler';
import { KnowledgeExtractJobHandler } from './handlers/knowledge-extract.handler';
import { SourceIndexJobHandler } from './handlers/source-index.handler';
import { TranscriptionRunJobHandler } from './handlers/transcription-run.handler';
import { VideoExtractJobHandler } from './handlers/video-extract.handler';
import { JobQueueService } from './queue.service';
import type { SourceJobHandler } from './source-job-handler';
import { JobName, type SourceJobPayload } from './types';

const NEXT_JOB: Partial<Record<JobName, JobName>> = {
  [JobName.VideoExtract]: JobName.TranscriptionRun,
  [JobName.TranscriptionRun]: JobName.KnowledgeExtract,
  [JobName.KnowledgeExtract]: JobName.EmbeddingsGenerate,
  [JobName.EmbeddingsGenerate]: JobName.SourceIndex,
};

/**
 * Dispatches queue jobs to the matching SourceJobHandler strategy,
 * then enqueues the next pipeline stage.
 */
@Service()
export class JobDispatcher {
  private readonly handlersByName: ReadonlyMap<JobName, SourceJobHandler>;

  constructor(
    videoExtract: VideoExtractJobHandler,
    transcriptionRun: TranscriptionRunJobHandler,
    knowledgeExtract: KnowledgeExtractJobHandler,
    embeddingsGenerate: EmbeddingsGenerateJobHandler,
    sourceIndex: SourceIndexJobHandler,
    private readonly queue: JobQueueService,
  ) {
    const handlers: SourceJobHandler[] = [
      videoExtract,
      transcriptionRun,
      knowledgeExtract,
      embeddingsGenerate,
      sourceIndex,
    ];
    this.handlersByName = new Map(
      handlers.map((handler) => [handler.name, handler]),
    );
  }

  async dispatch(
    name: JobName,
    payload: SourceJobPayload,
    logger: FastifyBaseLogger,
  ): Promise<void> {
    const handler = this.handlersByName.get(name);
    if (!handler) {
      throw new Error(`No handler registered for job: ${name}`);
    }
    await handler.execute(payload.sourceId, logger);
    await this.enqueueNext(name, payload.sourceId, logger);
  }

  private async enqueueNext(
    completed: JobName,
    sourceId: string,
    logger: FastifyBaseLogger,
  ): Promise<void> {
    const next = NEXT_JOB[completed];
    if (!next) {
      return;
    }

    const queued = await this.queue.enqueue(next, { sourceId });
    logger.info(
      {
        sourceId,
        from: completed,
        next,
        queueJobId: queued.queueJobId,
      },
      'Enqueued next pipeline job',
    );
  }
}

import type { FastifyBaseLogger } from 'fastify';
import { Service } from 'typedi';
import {
  buildPipelineNextJobMap,
} from '../video-knowledge/pipeline';
import { env } from '../config/env';
import { EmbeddingsGenerateJobHandler } from './handlers/embeddings-generate.handler';
import { KnowledgeExtractJobHandler } from './handlers/knowledge-extract.handler';
import { MultimodalKnowledgeJobHandler } from './handlers/multimodal-knowledge.handler';
import { SourceIndexJobHandler } from './handlers/source-index.handler';
import { SourceIngestJobHandler } from './handlers/source-ingest.handler';
import { TranscriptionRunJobHandler } from './handlers/transcription-run.handler';
import { VideoExtractJobHandler } from './handlers/video-extract.handler';
import { JobQueueService } from './queue.service';
import type {
  JobExecutionContext,
  SourceJobHandler,
} from './source-job-handler';
import { JobName, type SourceJobPayload } from './types';

/**
 * Dispatches queue jobs to the matching SourceJobHandler strategy,
 * then enqueues the next pipeline stage.
 */
@Service()
export class JobDispatcher {
  private readonly handlersByName: ReadonlyMap<JobName, SourceJobHandler>;
  private readonly nextJob: Partial<Record<JobName, JobName>>;

  constructor(
    sourceIngest: SourceIngestJobHandler,
    videoExtract: VideoExtractJobHandler,
    transcriptionRun: TranscriptionRunJobHandler,
    knowledgeExtract: KnowledgeExtractJobHandler,
    multimodalAnalyze: MultimodalKnowledgeJobHandler,
    embeddingsGenerate: EmbeddingsGenerateJobHandler,
    sourceIndex: SourceIndexJobHandler,
    private readonly queue: JobQueueService,
  ) {
    const handlers: SourceJobHandler[] = [
      sourceIngest,
      videoExtract,
      transcriptionRun,
      knowledgeExtract,
      multimodalAnalyze,
      embeddingsGenerate,
      sourceIndex,
    ];
    this.handlersByName = new Map(
      handlers.map((handler) => [handler.name, handler]),
    );
    this.nextJob = buildPipelineNextJobMap(env.videoProcessor);
  }

  async dispatch(
    name: JobName,
    payload: SourceJobPayload,
    logger: FastifyBaseLogger,
    context?: JobExecutionContext,
  ): Promise<void> {
    const handler = this.handlersByName.get(name);
    if (!handler) {
      throw new Error(`No handler registered for job: ${name}`);
    }
    await handler.execute(payload.sourceId, logger, context);
    await this.enqueueNext(name, payload.sourceId, logger);
  }

  private async enqueueNext(
    completed: JobName,
    sourceId: string,
    logger: FastifyBaseLogger,
  ): Promise<void> {
    const next = this.nextJob[completed];
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
        videoProcessor: env.videoProcessor,
      },
      'Enqueued next pipeline job',
    );
  }
}

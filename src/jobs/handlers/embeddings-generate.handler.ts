import type { FastifyBaseLogger } from 'fastify';
import { Service } from 'typedi';
import { EmbeddingService } from '../../embeddings';
import { JobQueueService } from '../queue.service';
import type { SourceJobHandler } from '../source-job-handler';
import { JobName } from '../types';

@Service()
export class EmbeddingsGenerateJobHandler implements SourceJobHandler {
  readonly name = JobName.EmbeddingsGenerate;

  constructor(
    private readonly embeddings: EmbeddingService,
    private readonly queue: JobQueueService,
  ) {}

  async execute(sourceId: string, logger: FastifyBaseLogger): Promise<void> {
    await this.embeddings.processSource(sourceId, logger);
    await this.queue.enqueueSourceIndex(sourceId);
  }
}

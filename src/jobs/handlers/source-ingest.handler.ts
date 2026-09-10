import type { FastifyBaseLogger } from 'fastify';
import { Service } from 'typedi';
import { SourceIngestService } from '../../video';
import type { SourceJobHandler } from '../source-job-handler';
import { JobName } from '../types';

@Service()
export class SourceIngestJobHandler implements SourceJobHandler {
  readonly name = JobName.SourceIngest;

  constructor(private readonly ingest: SourceIngestService) {}

  async execute(sourceId: string, logger: FastifyBaseLogger): Promise<void> {
    await this.ingest.runPendingIngest(sourceId, logger);
  }
}

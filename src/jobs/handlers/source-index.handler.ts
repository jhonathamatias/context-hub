import type { FastifyBaseLogger } from 'fastify';
import { Service } from 'typedi';
import type { SourceJobHandler } from '../source-job-handler';
import { SourceIndexService } from '../source-index.service';
import { JobName } from '../types';

@Service()
export class SourceIndexJobHandler implements SourceJobHandler {
  readonly name = JobName.SourceIndex;

  constructor(private readonly sourceIndex: SourceIndexService) {}

  async execute(sourceId: string, logger: FastifyBaseLogger): Promise<void> {
    await this.sourceIndex.finalize(sourceId, logger);
  }
}

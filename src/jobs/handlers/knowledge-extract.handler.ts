import type { FastifyBaseLogger } from 'fastify';
import { Service } from 'typedi';
import { KnowledgeService } from '../../knowledge';
import type { SourceJobHandler } from '../source-job-handler';
import { JobName } from '../types';

@Service()
export class KnowledgeExtractJobHandler implements SourceJobHandler {
  readonly name = JobName.KnowledgeExtract;

  constructor(private readonly knowledge: KnowledgeService) {}

  async execute(sourceId: string, logger: FastifyBaseLogger): Promise<void> {
    await this.knowledge.processSource(sourceId, logger);
  }
}

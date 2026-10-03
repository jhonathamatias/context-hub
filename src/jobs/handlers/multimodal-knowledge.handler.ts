import type { FastifyBaseLogger } from 'fastify';
import { Service } from 'typedi';
import type { SourceJobHandler } from '../source-job-handler';
import { JobName } from '../types';
import { MultimodalKnowledgeService } from '../../video-knowledge/multimodal-knowledge.service';

@Service()
export class MultimodalKnowledgeJobHandler implements SourceJobHandler {
  readonly name = JobName.MultimodalAnalyze;

  constructor(private readonly multimodal: MultimodalKnowledgeService) {}

  async execute(sourceId: string, logger: FastifyBaseLogger): Promise<void> {
    await this.multimodal.processSource(sourceId, logger);
  }
}

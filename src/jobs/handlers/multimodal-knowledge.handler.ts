import type { FastifyBaseLogger } from 'fastify';
import { Service } from 'typedi';
import { MultimodalKnowledgeService } from '../../video-knowledge/multimodal-knowledge.service';
import type {
  JobExecutionContext,
  SourceJobHandler,
} from '../source-job-handler';
import { JobName } from '../types';

@Service()
export class MultimodalKnowledgeJobHandler implements SourceJobHandler {
  readonly name = JobName.MultimodalAnalyze;

  constructor(private readonly multimodal: MultimodalKnowledgeService) {}

  async execute(
    sourceId: string,
    logger: FastifyBaseLogger,
    context?: JobExecutionContext,
  ): Promise<void> {
    await this.multimodal.processSource(sourceId, logger, context);
  }
}

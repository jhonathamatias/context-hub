import type { FastifyBaseLogger } from 'fastify';
import { Service } from 'typedi';
import { VisualEnrichmentService } from '../../visual-enrichment';
import type { SourceJobHandler } from '../source-job-handler';
import { JobName } from '../types';

/**
 * Soft-fail stage: VisualEnrichmentService never throws for enrichment failures.
 * Hard errors (missing source) still propagate.
 */
@Service()
export class VisualEnrichJobHandler implements SourceJobHandler {
  readonly name = JobName.VisualEnrich;

  constructor(private readonly visualEnrichment: VisualEnrichmentService) {}

  async execute(sourceId: string, logger: FastifyBaseLogger): Promise<void> {
    const result = await this.visualEnrichment.processSource(sourceId, logger);
    logger.info(
      {
        sourceId,
        status: result.status,
        selectedCount: result.selectedCount,
        clipsAnalyzed: result.clipsAnalyzed,
        warning: result.warning,
      },
      'Visual enrichment finished',
    );
  }
}

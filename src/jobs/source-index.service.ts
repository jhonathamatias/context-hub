import type { FastifyBaseLogger } from 'fastify';
import { Service } from 'typedi';
import {
  DatabaseService,
  ProcessingJob,
  ProcessingJobStatus,
  ProcessingStage,
  Source,
  SourceStatus,
} from '../database';
import { withProcessingLog } from '../observability';
import { ProcessingStateService } from '../processing';

/** Finalize after embeddings — records INDEX without rewriting vectors. */
@Service()
export class SourceIndexService {
  constructor(
    private readonly database: DatabaseService,
    private readonly state: ProcessingStateService,
  ) {}

  async finalize(sourceId: string, logger: FastifyBaseLogger): Promise<void> {
    const source = await this.requireSource(sourceId);

    if (await this.alreadyIndexed(sourceId, source, logger)) {
      return;
    }

    const job = await this.state.createJob(
      sourceId,
      ProcessingStage.INDEX,
      ProcessingJobStatus.RUNNING,
    );

    try {
      await withProcessingLog(
        logger,
        ProcessingStage.INDEX,
        { sourceId },
        async () => {
          await this.state.setSourceStatus(source, SourceStatus.READY);
        },
      );
      await this.state.markSucceeded(job);
    } catch (error) {
      await this.state.markFailed(job, error);
      throw error;
    }
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

  private async alreadyIndexed(
    sourceId: string,
    source: Source,
    logger: FastifyBaseLogger,
  ): Promise<boolean> {
    const existing = await this.database.getRepository(ProcessingJob).findOne({
      where: {
        sourceId,
        stage: ProcessingStage.INDEX,
        status: ProcessingJobStatus.SUCCEEDED,
      },
      order: { createdAt: 'DESC' },
    });
    if (!existing) {
      return false;
    }

    await this.state.setSourceStatus(source, SourceStatus.READY);
    logger.info({ sourceId, jobId: existing.id }, 'INDEX already complete');
    return true;
  }
}

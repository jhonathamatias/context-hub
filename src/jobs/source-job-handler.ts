import type { FastifyBaseLogger } from 'fastify';
import { JobName } from './types';

/** BullMQ attempt info passed into handlers that need retry-aware behavior. */
export type JobExecutionContext = {
  /** 1-based attempt number for this run. */
  attempt: number;
  /** Configured max attempts for this job. */
  maxAttempts: number;
  queueJobId?: string;
};

/** Strategy contract for one background job kind. */
export interface SourceJobHandler {
  readonly name: JobName;
  execute(
    sourceId: string,
    logger: FastifyBaseLogger,
    context?: JobExecutionContext,
  ): Promise<void>;
}

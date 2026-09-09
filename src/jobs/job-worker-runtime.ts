import { Worker, type ConnectionOptions, type Job } from 'bullmq';
import type { FastifyBaseLogger } from 'fastify';
import { Service } from 'typedi';
import { env } from '../config/env';
import { JobDispatcher } from './job-dispatcher';
import { ALL_JOB_NAMES, type JobName, type SourceJobPayload } from './types';

/**
 * Owns BullMQ Worker lifecycle for all pipeline job queues.
 */
@Service()
export class JobWorkerRuntime {
  private workers: Worker<SourceJobPayload>[] = [];
  private logger: FastifyBaseLogger | null = null;

  constructor(private readonly dispatcher: JobDispatcher) {}

  start(logger: FastifyBaseLogger): void {
    if (this.workers.length > 0) {
      throw new Error('JobWorkerRuntime already started');
    }

    this.logger = logger;
    const connection = this.createConnection();
    this.workers = ALL_JOB_NAMES.map((name) =>
      this.createWorker(name, connection, logger),
    );

    logger.info(
      {
        concurrency: env.jobs.concurrency,
        attempts: env.jobs.attempts,
        queues: ALL_JOB_NAMES,
      },
      'Background workers started',
    );
  }

  async stop(): Promise<void> {
    const workers = this.workers;
    this.workers = [];
    await Promise.all(workers.map((worker) => worker.close()));
    this.logger?.info('Background workers stopped');
    this.logger = null;
  }

  private createConnection(): ConnectionOptions {
    return { url: env.redisUrl, maxRetriesPerRequest: null };
  }

  private createWorker(
    name: JobName,
    connection: ConnectionOptions,
    logger: FastifyBaseLogger,
  ): Worker<SourceJobPayload> {
    const worker = new Worker<SourceJobPayload>(
      name,
      async (job) => this.processJob(name, job, logger),
      {
        connection,
        concurrency: env.jobs.concurrency,
        lockDuration: env.jobs.lockDurationMs,
      },
    );

    worker.on('failed', (job, error) => {
      logger.error(
        {
          err: error,
          queueJobId: job?.id,
          jobName: job?.name,
          sourceId: job?.data.sourceId,
          attemptsMade: job?.attemptsMade,
        },
        'Job failed',
      );
    });

    return worker;
  }

  private async processJob(
    name: JobName,
    job: Job<SourceJobPayload>,
    logger: FastifyBaseLogger,
  ): Promise<void> {
    const jobLogger = logger.child({
      queueJobId: job.id,
      jobName: name,
      sourceId: job.data.sourceId,
      attempt: job.attemptsMade + 1,
    });
    jobLogger.info('Job started');
    await this.dispatcher.dispatch(name, job.data, jobLogger);
    jobLogger.info('Job completed');
  }
}

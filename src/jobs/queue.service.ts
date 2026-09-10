import { Queue, type ConnectionOptions, type JobsOptions } from 'bullmq';
import { Service } from 'typedi';
import { env } from '../config/env';
import { JobName, type SourceJobPayload } from './types';

const DEFAULT_JOB_OPTIONS: JobsOptions = {
  removeOnComplete: 100,
  removeOnFail: 200,
  backoff: { type: 'exponential', delay: 2_000 },
};

export type EnqueuedJob = {
  queueJobId: string;
  jobName: JobName;
  sourceId: string;
};

/**
 * BullMQ stays behind this service so HTTP/use-cases never import the vendor API.
 */
@Service()
export class JobQueueService {
  private readonly queues = new Map<JobName, Queue<SourceJobPayload>>();
  private connection: ConnectionOptions | null = null;

  private getConnection(): ConnectionOptions {
    this.connection ??= {
      url: env.redisUrl,
      maxRetriesPerRequest: null,
    };
    return this.connection;
  }

  private getQueue(name: JobName): Queue<SourceJobPayload> {
    const cached = this.queues.get(name);
    if (cached) {
      return cached;
    }

    const queue = new Queue<SourceJobPayload>(name, {
      connection: this.getConnection(),
      defaultJobOptions: {
        ...DEFAULT_JOB_OPTIONS,
        attempts: env.jobs.attempts,
      },
    });
    this.queues.set(name, queue);
    return queue;
  }

  async enqueue(
    name: JobName,
    payload: SourceJobPayload,
    options?: { force?: boolean },
  ): Promise<EnqueuedJob> {
    const queue = this.getQueue(name);

    if (!options?.force) {
      const existing = await this.findInflight(queue, payload.sourceId);
      if (existing) {
        return existing;
      }
    }

    const job = await queue.add(name, payload, {
      jobId: `${payload.sourceId}-${Date.now()}`,
      attempts: env.jobs.attempts,
      backoff: { type: 'exponential', delay: 2_000 },
    });

    return {
      queueJobId: String(job.id),
      jobName: name,
      sourceId: payload.sourceId,
    };
  }

  async enqueueVideoExtract(sourceId: string) {
    return this.enqueue(JobName.VideoExtract, { sourceId });
  }

  async enqueueTranscription(sourceId: string) {
    return this.enqueue(JobName.TranscriptionRun, { sourceId }, { force: true });
  }

  async enqueueKnowledge(sourceId: string) {
    return this.enqueue(JobName.KnowledgeExtract, { sourceId });
  }

  async enqueueEmbeddings(sourceId: string) {
    return this.enqueue(JobName.EmbeddingsGenerate, { sourceId });
  }

  async enqueueSourceIndex(sourceId: string) {
    return this.enqueue(JobName.SourceIndex, { sourceId });
  }

  async close(): Promise<void> {
    await Promise.all([...this.queues.values()].map((queue) => queue.close()));
    this.queues.clear();
  }

  private async findInflight(
    queue: Queue<SourceJobPayload>,
    sourceId: string,
  ): Promise<EnqueuedJob | null> {
    const inflight = await queue.getJobs(['waiting', 'active', 'delayed']);
    const existing = inflight.find((job) => job.data.sourceId === sourceId);
    if (!existing?.id) {
      return null;
    }
    return {
      queueJobId: String(existing.id),
      jobName: existing.name as JobName,
      sourceId,
    };
  }
}

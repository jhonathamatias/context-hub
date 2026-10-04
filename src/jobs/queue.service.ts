import { Queue, type ConnectionOptions, type JobsOptions } from 'bullmq';
import { Service } from 'typedi';
import { env } from '../config/env';
import { multimodalTotalAttempts } from '../video-knowledge/multimodal-attempts';
import { isMultimodalPipeline } from '../video-knowledge/pipeline';
import { JobName, type SourceJobPayload } from './types';

const DEFAULT_JOB_OPTIONS: JobsOptions = {
  removeOnComplete: 100,
  removeOnFail: 200,
  backoff: { type: 'exponential', delay: 2_000 },
};

/** Multimodal uses longer backoff + native BullMQ jitter (avoids worker sleep). */
function optionsForJob(name: JobName): JobsOptions {
  if (name === JobName.MultimodalAnalyze) {
    return {
      removeOnComplete: 100,
      removeOnFail: 200,
      attempts: multimodalTotalAttempts(),
      backoff: {
        type: 'exponential',
        delay: env.gemini.videoRetryDelayMs,
        jitter: 0.25,
      },
    };
  }

  return {
    ...DEFAULT_JOB_OPTIONS,
    attempts: env.jobs.attempts,
  };
}

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
      defaultJobOptions: optionsForJob(name),
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
      ...optionsForJob(name),
    });

    return {
      queueJobId: String(job.id),
      jobName: name,
      sourceId: payload.sourceId,
    };
  }

  async enqueueSourceIngest(sourceId: string) {
    return this.enqueue(JobName.SourceIngest, { sourceId }, { force: true });
  }

  async enqueueVideoExtract(sourceId: string) {
    return this.enqueue(JobName.VideoExtract, { sourceId });
  }

  /** First stage after the video file is on disk (legacy extract vs multimodal). */
  async enqueuePostIngest(sourceId: string) {
    if (isMultimodalPipeline(env.videoProcessor)) {
      return this.enqueue(JobName.MultimodalAnalyze, { sourceId }, { force: true });
    }
    return this.enqueueVideoExtract(sourceId);
  }

  async enqueueTranscription(sourceId: string) {
    return this.enqueue(JobName.TranscriptionRun, { sourceId }, { force: true });
  }

  async enqueueKnowledge(sourceId: string) {
    return this.enqueue(JobName.KnowledgeExtract, { sourceId }, { force: true });
  }

  async enqueueVisualEnrich(sourceId: string) {
    return this.enqueue(JobName.VisualEnrich, { sourceId }, { force: true });
  }

  async enqueueMultimodalAnalyze(sourceId: string) {
    return this.enqueue(JobName.MultimodalAnalyze, { sourceId }, { force: true });
  }

  async enqueueEmbeddings(sourceId: string) {
    return this.enqueue(JobName.EmbeddingsGenerate, { sourceId }, { force: true });
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

import { Service } from 'typedi';
import {
  DatabaseService,
  ProcessingJob,
  ProcessingJobStatus,
  ProcessingStage,
  Source,
  SourceStatus,
} from '../database';

/**
 * Owns transitions of ProcessingJob / Source status.
 * Keeps pipeline services free of duplicated status bookkeeping.
 */
@Service()
export class ProcessingStateService {
  constructor(private readonly database: DatabaseService) {}

  formatError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  async createJob(
    sourceId: string,
    stage: ProcessingStage,
    status: ProcessingJobStatus,
  ): Promise<ProcessingJob> {
    const jobRepo = this.database.getRepository(ProcessingJob);
    const job = jobRepo.create({
      sourceId,
      stage,
      status,
      startedAt: status === ProcessingJobStatus.RUNNING ? new Date() : null,
      errorMessage: null,
      finishedAt: null,
    });
    return jobRepo.save(job);
  }

  async markRunning(job: ProcessingJob): Promise<void> {
    job.status = ProcessingJobStatus.RUNNING;
    job.startedAt = new Date();
    job.finishedAt = null;
    job.errorMessage = null;
    await this.database.getRepository(ProcessingJob).save(job);
  }

  async markSucceeded(job: ProcessingJob): Promise<void> {
    job.status = ProcessingJobStatus.SUCCEEDED;
    job.finishedAt = new Date();
    await this.database.getRepository(ProcessingJob).save(job);
  }

  async markFailed(job: ProcessingJob, error: unknown): Promise<void> {
    job.status = ProcessingJobStatus.FAILED;
    job.finishedAt = new Date();
    job.errorMessage = this.formatError(error);
    await this.database.getRepository(ProcessingJob).save(job);
  }

  async setSourceStatus(source: Source, status: SourceStatus): Promise<void> {
    if (source.status === status) {
      return;
    }
    source.status = status;
    await this.database.getRepository(Source).save(source);
  }
}

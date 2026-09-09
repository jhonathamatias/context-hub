import type { FastifyBaseLogger } from 'fastify';
import { Service } from 'typedi';
import { TranscriptionService } from '../../transcription';
import type { SourceJobHandler } from '../source-job-handler';
import { JobName } from '../types';

@Service()
export class TranscriptionRunJobHandler implements SourceJobHandler {
  readonly name = JobName.TranscriptionRun;

  constructor(private readonly transcription: TranscriptionService) {}

  async execute(sourceId: string, logger: FastifyBaseLogger): Promise<void> {
    await this.transcription.transcribeSource(sourceId, logger);
  }
}

import type { FastifyBaseLogger } from 'fastify';
import { JobName } from './types';

/** Strategy contract for one background job kind. */
export interface SourceJobHandler {
  readonly name: JobName;
  execute(sourceId: string, logger: FastifyBaseLogger): Promise<void>;
}

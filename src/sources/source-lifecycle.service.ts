import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { FastifyBaseLogger } from 'fastify';
import { Service } from 'typedi';
import { env } from '../config/env';
import { DatabaseService, Source, SourceStatus } from '../database';

export type UpdateSourceInput = {
  originalName: string;
};

@Service()
export class SourceLifecycleService {
  constructor(private readonly database: DatabaseService) {}

  async update(
    sourceId: string,
    input: UpdateSourceInput,
  ): Promise<Source> {
    const repo = this.database.getRepository(Source);
    const source = await repo.findOne({ where: { id: sourceId } });
    if (!source) {
      const error = new Error(`Source not found: ${sourceId}`);
      (error as Error & { statusCode?: number }).statusCode = 404;
      throw error;
    }

    source.originalName = input.originalName.trim();
    return repo.save(source);
  }

  async delete(sourceId: string, logger?: FastifyBaseLogger): Promise<void> {
    const repo = this.database.getRepository(Source);
    const source = await repo.findOne({ where: { id: sourceId } });
    if (!source) {
      const error = new Error(`Source not found: ${sourceId}`);
      (error as Error & { statusCode?: number }).statusCode = 404;
      throw error;
    }

    await repo.delete({ id: sourceId });

    const sourceDir = join(env.storageDir, 'sources', sourceId);
    const originalPath = join(env.storageDir, source.storageKey);
    await Promise.allSettled([
      rm(sourceDir, { recursive: true, force: true }),
      rm(originalPath, { force: true }),
    ]);

    logger?.info({ sourceId }, 'Source deleted');
  }

  async markProcessing(sourceId: string): Promise<Source> {
    const repo = this.database.getRepository(Source);
    const source = await repo.findOne({ where: { id: sourceId } });
    if (!source) {
      const error = new Error(`Source not found: ${sourceId}`);
      (error as Error & { statusCode?: number }).statusCode = 404;
      throw error;
    }
    source.status = SourceStatus.PROCESSING;
    return repo.save(source);
  }
}

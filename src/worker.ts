import 'reflect-metadata';
import { pino } from 'pino';
import { Container } from 'typedi';
import { env } from './config/env';
import { DatabaseService } from './database';
import { registerDomainProviders } from './di';
import { JobQueueService, JobWorkerRuntime } from './jobs';
import { buildLoggerOptions } from './observability';
import { RedisService } from './redis';

async function main() {
  const logger = pino(buildLoggerOptions());
  registerDomainProviders(logger);

  const database = Container.get(DatabaseService);
  const redis = Container.get(RedisService);
  const jobs = Container.get(JobQueueService);
  const workers = Container.get(JobWorkerRuntime);

  await database.connect();
  logger.info('Worker database connected');
  await redis.connect();
  logger.info('Worker redis connected');

  workers.start(logger);
  logger.info(
    {
      concurrency: env.jobs.concurrency,
      attempts: env.jobs.attempts,
    },
    'Worker process ready',
  );

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Worker shutting down');
    try {
      await workers.stop();
      await jobs.close();
      await redis.disconnect();
      await database.disconnect();
      process.exit(0);
    } catch (error) {
      logger.error(error, 'Worker shutdown failed');
      process.exit(1);
    }
  };

  process.once('SIGINT', () => {
    void shutdown('SIGINT');
  });
  process.once('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});

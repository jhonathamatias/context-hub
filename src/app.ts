import 'reflect-metadata';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify from 'fastify';
import { Container } from 'typedi';
import { env } from './config/env';
import { DatabaseService } from './database';
import { registerDomainProviders } from './di';
import { JobQueueService } from './jobs';
import {
  buildLoggerOptions,
  generateRequestId,
  registerErrorHandler,
} from './observability';
import { RedisService } from './redis';
import { healthRoute } from './routes/health.route';
import { integrationsRoute } from './routes/integrations.route';
import { searchRoute } from './routes/search.route';
import { sourcesRoute } from './routes/sources.route';

export async function buildApp() {
  const app = Fastify({
    logger: buildLoggerOptions(),
    genReqId: generateRequestId,
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
    disableRequestLogging: false,
  });

  app.addHook('onRequest', async (request, reply) => {
    reply.header('x-request-id', request.id);
  });

  registerErrorHandler(app);

  await app.register(cors, {
    origin: true,
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Context Hub API',
        description: 'Turn lesson videos into searchable, grounded answers',
        version: '1.0.0',
      },
      tags: [
        { name: 'health' },
        { name: 'sources' },
        { name: 'integrations' },
        { name: 'search' },
        { name: 'chat' },
      ],
    },
  });
  await app.register(swaggerUi, {
    routePrefix: '/docs',
  });

  await app.register(multipart, {
    limits: {
      files: 1,
      fileSize: env.maxUploadBytes,
    },
  });

  registerDomainProviders(app.log);

  const database = Container.get(DatabaseService);
  const redis = Container.get(RedisService);
  const jobs = Container.get(JobQueueService);

  app.addHook('onReady', async () => {
    try {
      await database.connect();
      app.log.info('Database connected');
    } catch (error) {
      app.log.error(error, 'Failed to connect to database');
      throw error;
    }

    try {
      await redis.connect();
      app.log.info('Redis connected');
    } catch (error) {
      app.log.error(error, 'Failed to connect to Redis');
      throw error;
    }
  });

  app.addHook('onClose', async () => {
    try {
      await jobs.close();
      app.log.info('Job queues closed');
    } catch (error) {
      app.log.error(error, 'Failed to close job queues cleanly');
    }

    try {
      await redis.disconnect();
      app.log.info('Redis disconnected');
    } catch (error) {
      app.log.error(error, 'Failed to disconnect Redis cleanly');
    }

    try {
      await database.disconnect();
      app.log.info('Database disconnected');
    } catch (error) {
      app.log.error(error, 'Failed to disconnect database cleanly');
    }
  });

  await app.register(healthRoute);
  await app.register(sourcesRoute);
  await app.register(integrationsRoute);
  await app.register(searchRoute);

  return app;
}

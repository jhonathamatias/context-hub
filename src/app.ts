import 'reflect-metadata';
import Fastify from 'fastify';
import { Container } from 'typedi';
import { env } from './config/env';
import { DatabaseService } from './database';
import {
  buildLoggerOptions,
  generateRequestId,
  registerErrorHandler,
} from './observability';
import { RedisService } from './redis';
import { healthRoute } from './routes/health.route';

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

  const database = Container.get(DatabaseService);
  const redis = Container.get(RedisService);

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

  return app;
}

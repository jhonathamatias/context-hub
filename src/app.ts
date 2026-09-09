import 'reflect-metadata';
import multipart from '@fastify/multipart';
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
import { sourcesRoute } from './routes/sources.route';
import {
  LocalWhisperTranscriptionProvider,
  TRANSCRIPTION_PROVIDER,
} from './transcription';
import {
  GeminiKnowledgeExtractionProvider,
  KNOWLEDGE_EXTRACTION_PROVIDER,
  OpenAiKnowledgeExtractionProvider,
} from './knowledge';

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

  await app.register(multipart, {
    limits: {
      files: 1,
      fileSize: env.maxUploadBytes,
    },
  });

  // Swap this binding later to use an API-based provider without changing domain services.
  Container.set(
    TRANSCRIPTION_PROVIDER,
    Container.get(LocalWhisperTranscriptionProvider),
  );
  Container.set(
    KNOWLEDGE_EXTRACTION_PROVIDER,
    env.knowledgeProvider === 'gemini'
      ? Container.get(GeminiKnowledgeExtractionProvider)
      : Container.get(OpenAiKnowledgeExtractionProvider),
  );
  app.log.info(
    { knowledgeProvider: env.knowledgeProvider },
    'Knowledge extraction provider selected',
  );

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
  await app.register(sourcesRoute);

  return app;
}

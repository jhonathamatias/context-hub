import 'reflect-metadata';
import multipart from '@fastify/multipart';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
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
import { searchRoute } from './routes/search.route';
import { sourcesRoute } from './routes/sources.route';
import {
  LocalWhisperTranscriptionProvider,
  TRANSCRIPTION_PROVIDER,
} from './transcription';
import {
  EMBEDDING_PROVIDER,
  GeminiEmbeddingProvider,
  OpenAiEmbeddingProvider,
} from './embeddings';
import {
  KNOWLEDGE_EXTRACTION_PROVIDER,
  LlmKnowledgeExtractionProvider,
} from './knowledge';
import { PgVectorRepository, VECTOR_REPOSITORY } from './search';
import {
  ANSWER_GENERATION_PROVIDER,
  LlmAnswerGenerationProvider,
} from './context';
import {
  GeminiLlmProvider,
  LLM_PROVIDER,
  OpenAiLlmProvider,
} from './llm';

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

  // Vendor SDKs stay behind LlmProvider / EmbeddingProvider ports.
  Container.set(
    TRANSCRIPTION_PROVIDER,
    Container.get(LocalWhisperTranscriptionProvider),
  );
  Container.set(
    LLM_PROVIDER,
    env.llm.provider === 'gemini'
      ? Container.get(GeminiLlmProvider)
      : Container.get(OpenAiLlmProvider),
  );
  Container.set(
    KNOWLEDGE_EXTRACTION_PROVIDER,
    Container.get(LlmKnowledgeExtractionProvider),
  );
  Container.set(
    EMBEDDING_PROVIDER,
    env.embedding.provider === 'gemini'
      ? Container.get(GeminiEmbeddingProvider)
      : Container.get(OpenAiEmbeddingProvider),
  );
  Container.set(VECTOR_REPOSITORY, Container.get(PgVectorRepository));
  Container.set(
    ANSWER_GENERATION_PROVIDER,
    Container.get(LlmAnswerGenerationProvider),
  );
  app.log.info(
    {
      llmProvider: env.llm.provider,
      llmTimeoutMs: env.llm.timeoutMs,
      llmMaxRetries: env.llm.maxRetries,
    },
    'LLM provider selected',
  );
  app.log.info(
    {
      embeddingProvider: env.embedding.provider,
      embeddingModel:
        env.embedding.provider === 'gemini'
          ? env.embedding.geminiModel
          : env.embedding.openaiModel,
    },
    'Embedding provider selected',
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
  await app.register(searchRoute);

  return app;
}

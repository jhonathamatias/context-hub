import type { FastifyInstance } from 'fastify';
import { Container } from 'typedi';
import { SourcesController } from '../controllers';
import {
  ingestFilesystemBodySchema,
  ingestOneDriveBodySchema,
  listSourcesQuerySchema,
  oneDriveStreamQuerySchema,
  previewOneDriveBodySchema,
  sourceIdParamsSchema,
  validateZod,
} from '../http';
import { errorResponseSchema } from '../http/openapi-schemas';

const sourceIdValidation = {
  preHandler: validateZod({ params: sourceIdParamsSchema }),
  schema: {
    tags: ['sources'],
    response: { 400: errorResponseSchema, 404: errorResponseSchema },
  },
} as const;

export async function sourcesRoute(app: FastifyInstance) {
  const controller = Container.get(SourcesController);

  app.post(
    '/sources/videos',
    {
      schema: {
        tags: ['sources'],
        summary: 'Upload a lesson video (multipart)',
        consumes: ['multipart/form-data'],
        response: { 400: errorResponseSchema },
      },
    },
    (request, reply) => controller.upload(request, reply),
  );

  // Backward-compatible alias
  app.post('/sources/upload', (request, reply) =>
    controller.upload(request, reply),
  );

  app.post(
    '/sources/from-filesystem',
    {
      preHandler: validateZod({ body: ingestFilesystemBodySchema }),
      schema: {
        tags: ['sources'],
        summary: 'Ingest a video already present on the server filesystem',
        response: { 400: errorResponseSchema },
      },
    },
    (request, reply) => controller.fromFilesystem(request, reply),
  );

  app.post(
    '/sources/onedrive/preview',
    {
      preHandler: validateZod({ body: previewOneDriveBodySchema }),
      schema: {
        tags: ['sources'],
        summary: 'List video files behind a OneDrive / SharePoint sharing link',
        response: { 400: errorResponseSchema },
      },
    },
    (request, reply) => controller.previewOneDrive(request, reply),
  );

  app.get(
    '/sources/onedrive/stream',
    {
      preHandler: validateZod({ query: oneDriveStreamQuerySchema }),
      schema: {
        tags: ['sources'],
        summary: 'Stream a OneDrive video for in-browser preview (Range supported)',
        response: { 400: errorResponseSchema, 404: errorResponseSchema },
      },
    },
    (request, reply) => controller.streamOneDrivePreview(request, reply),
  );

  app.post(
    '/sources/onedrive',
    {
      preHandler: validateZod({ body: ingestOneDriveBodySchema }),
      schema: {
        tags: ['sources'],
        summary:
          'Import video(s) from a OneDrive / SharePoint sharing link into the pipeline',
        response: { 400: errorResponseSchema },
      },
    },
    (request, reply) => controller.fromOneDrive(request, reply),
  );

  app.get(
    '/sources',
    {
      preHandler: validateZod({ query: listSourcesQuerySchema }),
      schema: {
        tags: ['sources'],
        summary: 'List ingested sources',
        response: { 400: errorResponseSchema },
      },
    },
    (request, reply) => controller.list(request, reply),
  );

  app.get(
    '/sources/:sourceId',
    {
      ...sourceIdValidation,
      schema: {
        ...sourceIdValidation.schema,
        summary: 'Get a source by id',
      },
    },
    (request, reply) => controller.getById(request, reply),
  );

  app.get(
    '/sources/:sourceId/status',
    {
      ...sourceIdValidation,
      schema: {
        ...sourceIdValidation.schema,
        summary: 'Get pipeline status for a source',
      },
    },
    (request, reply) => controller.getStatus(request, reply),
  );

  app.get(
    '/sources/:sourceId/media',
    {
      ...sourceIdValidation,
      schema: {
        ...sourceIdValidation.schema,
        summary: 'Stream the original lesson video (supports Range)',
      },
    },
    (request, reply) => controller.streamMedia(request, reply),
  );

  app.get(
    '/sources/:sourceId/transcript',
    {
      ...sourceIdValidation,
      schema: {
        ...sourceIdValidation.schema,
        summary: 'Get the completed transcript for a source',
      },
    },
    (request, reply) => controller.getTranscript(request, reply),
  );

  app.get(
    '/sources/:sourceId/knowledge',
    {
      ...sourceIdValidation,
      schema: {
        ...sourceIdValidation.schema,
        summary: 'Get extracted lesson knowledge for a source',
      },
    },
    (request, reply) => controller.getKnowledge(request, reply),
  );

  app.post(
    '/sources/:sourceId/transcribe',
    {
      ...sourceIdValidation,
      schema: {
        ...sourceIdValidation.schema,
        summary: 'Transcribe a source',
      },
    },
    (request, reply) => controller.transcribe(request, reply),
  );

  app.post(
    '/sources/:sourceId/knowledge',
    {
      ...sourceIdValidation,
      schema: {
        tags: ['sources'],
        summary: 'Extract structured knowledge from a transcript',
        response: { 400: errorResponseSchema },
      },
    },
    (request, reply) => controller.enqueueKnowledge(request, reply),
  );

  app.post(
    '/sources/:sourceId/embeddings',
    {
      ...sourceIdValidation,
      schema: {
        tags: ['sources'],
        summary: 'Embed transcript chunks for semantic search',
        response: { 400: errorResponseSchema },
      },
    },
    (request, reply) => controller.embeddings(request, reply),
  );
}

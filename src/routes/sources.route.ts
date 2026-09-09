import type { FastifyInstance } from 'fastify';
import { Container } from 'typedi';
import { SourcesController } from '../controllers';

export async function sourcesRoute(app: FastifyInstance) {
  const controller = Container.get(SourcesController);

  app.post('/sources/upload', (request, reply) =>
    controller.upload(request, reply),
  );

  app.post('/sources/from-filesystem', (request, reply) =>
    controller.fromFilesystem(request, reply),
  );

  app.post('/sources/:sourceId/transcribe', (request, reply) =>
    controller.transcribe(request, reply),
  );

  app.post('/sources/:sourceId/knowledge', (request, reply) =>
    controller.knowledge(request, reply),
  );

  app.post('/sources/:sourceId/embeddings', (request, reply) =>
    controller.embeddings(request, reply),
  );
}

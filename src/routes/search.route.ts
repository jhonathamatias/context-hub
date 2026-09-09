import type { FastifyInstance } from 'fastify';
import { Container } from 'typedi';
import { SearchController } from '../controllers';
import {
  askBodySchema,
  chatBodySchema,
  searchBodySchema,
  validateZod,
} from '../http';
import { errorResponseSchema } from '../http/openapi-schemas';

export async function searchRoute(app: FastifyInstance) {
  const controller = Container.get(SearchController);

  app.post(
    '/search',
    {
      preHandler: validateZod({ body: searchBodySchema }),
      schema: {
        tags: ['search'],
        summary: 'Semantic search over indexed lesson chunks',
        response: { 400: errorResponseSchema },
      },
    },
    (request, reply) => controller.search(request, reply),
  );

  app.post(
    '/ask',
    {
      preHandler: validateZod({ body: askBodySchema }),
      schema: {
        tags: ['chat'],
        summary: 'Ask a grounded question (internal/compat alias of /chat)',
        response: { 400: errorResponseSchema },
      },
    },
    (request, reply) => controller.ask(request, reply),
  );

  app.post(
    '/chat',
    {
      preHandler: validateZod({ body: chatBodySchema }),
      schema: {
        tags: ['chat'],
        summary: 'Chat against indexed lessons with citations',
        response: { 400: errorResponseSchema },
      },
    },
    (request, reply) => controller.chat(request, reply),
  );
}

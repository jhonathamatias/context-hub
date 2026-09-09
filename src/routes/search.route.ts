import type { FastifyInstance } from 'fastify';
import { Container } from 'typedi';
import { SearchController } from '../controllers';

export async function searchRoute(app: FastifyInstance) {
  const controller = Container.get(SearchController);

  app.post('/search', (request, reply) => controller.search(request, reply));
}

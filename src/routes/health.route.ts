import type { FastifyInstance } from 'fastify';
import { Container } from 'typedi';
import { HealthController } from '../controllers';

export async function healthRoute(app: FastifyInstance) {
  const controller = Container.get(HealthController);

  app.get('/health', (request, reply) => controller.check(request, reply));
}

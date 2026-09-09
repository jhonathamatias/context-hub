import type { FastifyInstance } from 'fastify';
import { Container } from 'typedi';
import { HealthService } from '../services/health.service';

export async function healthRoute(app: FastifyInstance) {
  const healthService = Container.get(HealthService);

  app.get('/health', async (_request, reply) => {
    const result = await healthService.check();

    return reply.status(result.statusCode).send({
      status: result.status,
      database: result.database,
      redis: result.redis,
    });
  });
}

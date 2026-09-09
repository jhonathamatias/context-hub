import type { FastifyInstance } from 'fastify';
import { Container } from 'typedi';
import { HealthController } from '../controllers';
import {
  errorResponseSchema,
  healthResponseSchema,
} from '../http/openapi-schemas';

export async function healthRoute(app: FastifyInstance) {
  const controller = Container.get(HealthController);

  app.get(
    '/health',
    {
      schema: {
        tags: ['health'],
        summary: 'Liveness and dependency checks',
        response: {
          200: healthResponseSchema,
          503: healthResponseSchema,
          400: errorResponseSchema,
        },
      },
    },
    (request, reply) => controller.check(request, reply),
  );
}

import type { FastifyInstance } from 'fastify';
import { Container } from 'typedi';
import { IntegrationsController } from '../controllers';
import {
  createIntegrationBodySchema,
  integrationIdParamsSchema,
  listIntegrationsQuerySchema,
  updateIntegrationBodySchema,
  validateZod,
} from '../http';
import { errorResponseSchema } from '../http/openapi-schemas';

export async function integrationsRoute(app: FastifyInstance) {
  const controller = Container.get(IntegrationsController);

  app.get(
    '/integrations',
    {
      preHandler: validateZod({ query: listIntegrationsQuerySchema }),
      schema: {
        tags: ['integrations'],
        summary: 'List saved source integrations',
        response: { 400: errorResponseSchema },
      },
    },
    (request, reply) => controller.list(request, reply),
  );

  app.post(
    '/integrations',
    {
      preHandler: validateZod({ body: createIntegrationBodySchema }),
      schema: {
        tags: ['integrations'],
        summary: 'Create a source integration (e.g. OneDrive)',
        response: { 400: errorResponseSchema },
      },
    },
    (request, reply) => controller.create(request, reply),
  );

  app.get(
    '/integrations/:integrationId',
    {
      preHandler: validateZod({ params: integrationIdParamsSchema }),
      schema: {
        tags: ['integrations'],
        summary: 'Get one integration (token never returned)',
        response: { 400: errorResponseSchema, 404: errorResponseSchema },
      },
    },
    (request, reply) => controller.get(request, reply),
  );

  app.patch(
    '/integrations/:integrationId',
    {
      preHandler: validateZod({
        params: integrationIdParamsSchema,
        body: updateIntegrationBodySchema,
      }),
      schema: {
        tags: ['integrations'],
        summary: 'Update an integration',
        response: { 400: errorResponseSchema, 404: errorResponseSchema },
      },
    },
    (request, reply) => controller.update(request, reply),
  );

  app.delete(
    '/integrations/:integrationId',
    {
      preHandler: validateZod({ params: integrationIdParamsSchema }),
      schema: {
        tags: ['integrations'],
        summary: 'Delete an integration',
        response: { 400: errorResponseSchema, 404: errorResponseSchema },
      },
    },
    (request, reply) => controller.remove(request, reply),
  );
}

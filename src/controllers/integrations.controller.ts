import type { FastifyReply, FastifyRequest } from 'fastify';
import { Service } from 'typedi';
import {
  getBody,
  getParams,
  getQuery,
  type CreateIntegrationBody,
  type IntegrationIdParams,
  type ListIntegrationsQuery,
  type UpdateIntegrationBody,
} from '../http';
import { IntegrationService } from '../integrations';

@Service()
export class IntegrationsController {
  constructor(private readonly integrations: IntegrationService) {}

  async list(request: FastifyRequest, reply: FastifyReply) {
    const query = getQuery<ListIntegrationsQuery>(request);
    const items = await this.integrations.list(query.kind);
    return reply.status(200).send({ items, count: items.length });
  }

  async get(request: FastifyRequest, reply: FastifyReply) {
    const { integrationId } = getParams<IntegrationIdParams>(request);
    const item = await this.integrations.getPublicById(integrationId);
    return reply.status(200).send(item);
  }

  async create(request: FastifyRequest, reply: FastifyReply) {
    const body = getBody<CreateIntegrationBody>(request);
    const item = await this.integrations.create({
      kind: body.kind,
      name: body.name,
      ...(body.accessToken !== undefined
        ? { accessToken: body.accessToken }
        : {}),
      ...(body.shareUrl !== undefined ? { shareUrl: body.shareUrl } : {}),
    });
    return reply.status(201).send(item);
  }

  async update(request: FastifyRequest, reply: FastifyReply) {
    const { integrationId } = getParams<IntegrationIdParams>(request);
    const body = getBody<UpdateIntegrationBody>(request);
    const item = await this.integrations.update(integrationId, {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.accessToken !== undefined
        ? { accessToken: body.accessToken }
        : {}),
      ...(body.shareUrl !== undefined ? { shareUrl: body.shareUrl } : {}),
      ...(body.clearAccessToken !== undefined
        ? { clearAccessToken: body.clearAccessToken }
        : {}),
    });
    return reply.status(200).send(item);
  }

  async remove(request: FastifyRequest, reply: FastifyReply) {
    const { integrationId } = getParams<IntegrationIdParams>(request);
    await this.integrations.remove(integrationId);
    return reply.status(204).send();
  }
}

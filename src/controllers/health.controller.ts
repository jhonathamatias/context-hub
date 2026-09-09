import type { FastifyReply, FastifyRequest } from 'fastify';
import { Service } from 'typedi';
import { HealthService } from '../services/health.service';

@Service()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  async check(_request: FastifyRequest, reply: FastifyReply) {
    const result = await this.healthService.check();

    return reply.status(result.statusCode).send({
      status: result.status,
      database: result.database,
      redis: result.redis,
    });
  }
}

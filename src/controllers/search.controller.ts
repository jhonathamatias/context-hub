import type { FastifyReply, FastifyRequest } from 'fastify';
import { Service } from 'typedi';
import { parseInput, searchBodySchema } from '../http';
import { SemanticSearchService } from '../search';

@Service()
export class SearchController {
  constructor(private readonly searchService: SemanticSearchService) {}

  async search(request: FastifyRequest, reply: FastifyReply) {
    const body = parseInput(searchBodySchema, request.body ?? {});

    const result = await this.searchService.search(
      {
        query: body.query,
        ...(body.sourceId ? { sourceId: body.sourceId } : {}),
        ...(body.limit !== undefined ? { limit: body.limit } : {}),
      },
      request.log,
    );

    return reply.status(200).send(result);
  }
}

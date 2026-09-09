import type { FastifyReply, FastifyRequest } from 'fastify';
import { Service } from 'typedi';
import { ContextEngineService } from '../context';
import { askBodySchema, parseInput, searchBodySchema } from '../http';
import { SemanticSearchService } from '../search';

@Service()
export class SearchController {
  constructor(
    private readonly searchService: SemanticSearchService,
    private readonly contextEngine: ContextEngineService,
  ) {}

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

  async ask(request: FastifyRequest, reply: FastifyReply) {
    const body = parseInput(askBodySchema, request.body ?? {});

    const result = await this.contextEngine.ask(
      {
        question: body.question,
        ...(body.sourceId ? { sourceId: body.sourceId } : {}),
        ...(body.limit !== undefined ? { limit: body.limit } : {}),
        ...(body.mode ? { mode: body.mode } : {}),
      },
      request.log,
    );

    return reply.status(200).send(result);
  }
}

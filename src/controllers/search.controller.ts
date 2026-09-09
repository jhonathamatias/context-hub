import type { FastifyReply, FastifyRequest } from 'fastify';
import { Service } from 'typedi';
import { ContextEngineService } from '../context';
import type { AskRequest } from '../context';
import {
  getBody,
  type AskBody,
  type ChatBody,
  type SearchBody,
} from '../http';
import { SemanticSearchService } from '../search';
import type { SearchRequest } from '../search';

function resolveSourceIds(body: {
  sourceId?: string | undefined;
  sourceIds?: string[] | undefined;
}): string[] {
  return [
    ...new Set([
      ...(body.sourceIds ?? []),
      ...(body.sourceId ? [body.sourceId] : []),
    ]),
  ];
}

@Service()
export class SearchController {
  constructor(
    private readonly searchService: SemanticSearchService,
    private readonly contextEngine: ContextEngineService,
  ) {}

  async search(request: FastifyRequest, reply: FastifyReply) {
    const body = getBody<SearchBody>(request);
    const sourceIds = resolveSourceIds(body);

    const payload: SearchRequest = {
      query: body.query,
    };
    if (sourceIds.length === 1 && sourceIds[0]) {
      payload.sourceId = sourceIds[0];
      payload.sourceIds = sourceIds;
    } else if (sourceIds.length > 1) {
      payload.sourceIds = sourceIds;
    }
    if (body.limit !== undefined) {
      payload.limit = body.limit;
    }

    const result = await this.searchService.search(payload, request.log);
    return reply.status(200).send(result);
  }

  async ask(request: FastifyRequest, reply: FastifyReply) {
    const body = getBody<AskBody>(request);
    const result = await this.contextEngine.ask(
      this.toAskRequest(body),
      request.log,
    );
    return reply.status(200).send(result);
  }

  async chat(request: FastifyRequest, reply: FastifyReply) {
    const body = getBody<ChatBody>(request);
    const result = await this.contextEngine.ask(
      this.toAskRequest(body),
      request.log,
    );

    return reply.status(200).send({
      question: result.question,
      answer: result.answer,
      sufficientEvidence: result.sufficientEvidence,
      references: result.references,
      retrieval: result.retrieval,
      mode: result.mode,
    });
  }

  private toAskRequest(body: AskBody): AskRequest {
    const sourceIds = resolveSourceIds(body);
    const payload: AskRequest = {
      question: body.question,
    };
    if (sourceIds.length === 1 && sourceIds[0]) {
      payload.sourceId = sourceIds[0];
      payload.sourceIds = sourceIds;
    } else if (sourceIds.length > 1) {
      payload.sourceIds = sourceIds;
    }
    if (body.limit !== undefined) {
      payload.limit = body.limit;
    }
    if (body.mode) {
      payload.mode = body.mode;
    }
    if (body.history) {
      payload.history = body.history;
    }
    return payload;
  }
}

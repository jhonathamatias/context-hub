import type {
  FastifyReply,
  FastifyRequest,
  preHandlerHookHandler,
} from 'fastify';
import type { z } from 'zod';
import { parseInput } from './validate';

export type ZodRequestSchemas = {
  body?: z.ZodType;
  params?: z.ZodType;
  query?: z.ZodType;
};

/**
 * Fastify preHandler that validates (and coerces) request parts with Zod.
 * Replaces body/params/query with the parsed values so controllers stay thin.
 */
export function validateZod(
  schemas: ZodRequestSchemas,
): preHandlerHookHandler {
  return async function zodValidationMiddleware(
    request: FastifyRequest,
    _reply: FastifyReply,
  ): Promise<void> {
    if (schemas.body) {
      request.body = parseInput(schemas.body, request.body ?? {});
    }

    if (schemas.params) {
      request.params = parseInput(schemas.params, request.params ?? {});
    }

    if (schemas.query) {
      request.query = parseInput(schemas.query, request.query ?? {});
    }
  };
}

/** Read body after `validateZod` ran for that route. */
export function getBody<T>(request: FastifyRequest): T {
  return request.body as T;
}

/** Read params after `validateZod` ran for that route. */
export function getParams<T>(request: FastifyRequest): T {
  return request.params as T;
}

/** Read query after `validateZod` ran for that route. */
export function getQuery<T>(request: FastifyRequest): T {
  return request.query as T;
}

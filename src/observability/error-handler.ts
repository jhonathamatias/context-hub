import type { FastifyInstance } from 'fastify';
import { env } from '../config/env';

function getStatusCode(error: unknown): number {
  if (
    typeof error === 'object' &&
    error !== null &&
    'statusCode' in error &&
    typeof error.statusCode === 'number'
  ) {
    return error.statusCode;
  }

  return 500;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'Unexpected error';
}

function getErrorName(error: unknown): string {
  if (error instanceof Error && error.name) {
    return error.name;
  }

  return 'Error';
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    const statusCode = getStatusCode(error);
    const isServerError = statusCode >= 500;
    const isValidation =
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'FST_ERR_VALIDATION';

    if (isServerError) {
      request.log.error(
        {
          err: error,
          requestId: request.id,
        },
        'Unhandled server error',
      );
    } else {
      request.log.warn(
        {
          err: error,
          requestId: request.id,
        },
        'Request error',
      );
    }

    const message = isServerError
      ? env.nodeEnv === 'production'
        ? 'An unexpected error occurred'
        : getErrorMessage(error)
      : getErrorMessage(error);

    return reply.status(statusCode).send({
      statusCode,
      error: isServerError
        ? 'Internal Server Error'
        : isValidation
          ? 'Bad Request'
          : getErrorName(error),
      message,
      requestId: request.id,
    });
  });

  app.setNotFoundHandler((request, reply) => {
    return reply.status(404).send({
      statusCode: 404,
      error: 'Not Found',
      message: `Route ${request.method}:${request.url} not found`,
      requestId: request.id,
    });
  });
}

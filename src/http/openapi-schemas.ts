/** Lightweight JSON Schemas for Fastify/OpenAPI docs (runtime validation stays on Zod). */

export const errorResponseSchema = {
  type: 'object',
  properties: {
    statusCode: { type: 'integer' },
    error: { type: 'string' },
    message: { type: 'string' },
    requestId: { type: 'string' },
  },
} as const;

export const healthResponseSchema = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['ok', 'degraded'] },
    database: { type: 'string', enum: ['up', 'down'] },
    redis: { type: 'string', enum: ['up', 'down'] },
  },
} as const;

export const sourceIdParamsJsonSchema = {
  type: 'object',
  required: ['sourceId'],
  properties: {
    sourceId: { type: 'string', format: 'uuid' },
  },
} as const;

export const listSourcesQueryJsonSchema = {
  type: 'object',
  properties: {
    page: { type: 'integer', minimum: 1, default: 1 },
    pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    status: {
      type: 'string',
      enum: ['PENDING', 'PROCESSING', 'READY', 'FAILED'],
    },
  },
} as const;

export const chatBodyJsonSchema = {
  type: 'object',
  required: ['question'],
  properties: {
    question: { type: 'string', minLength: 1 },
    sourceId: { type: 'string', format: 'uuid' },
    sourceIds: {
      type: 'array',
      maxItems: 20,
      items: { type: 'string', format: 'uuid' },
    },
    limit: { type: 'integer', minimum: 1, maximum: 20 },
    mode: { type: 'string', enum: ['course'] },
    history: {
      type: 'array',
      maxItems: 6,
      items: {
        type: 'object',
        required: ['role', 'content'],
        properties: {
          role: { type: 'string', enum: ['user', 'assistant'] },
          content: { type: 'string', minLength: 1, maxLength: 2000 },
        },
      },
    },
  },
} as const;

export const searchBodyJsonSchema = {
  type: 'object',
  required: ['query'],
  properties: {
    query: { type: 'string', minLength: 1 },
    sourceId: { type: 'string', format: 'uuid' },
    sourceIds: {
      type: 'array',
      maxItems: 20,
      items: { type: 'string', format: 'uuid' },
    },
    limit: { type: 'integer', minimum: 1, maximum: 50 },
  },
} as const;

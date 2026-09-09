import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import Fastify from 'fastify';
import { z } from 'zod';
import { ValidationError } from './validate';
import { validateZod } from './zod-middleware';

describe('validateZod middleware', () => {
  it('parses and replaces body before the handler runs', async () => {
    const app = Fastify();
    const schema = z.object({
      name: z.string().trim().min(1),
      limit: z.coerce.number().int().positive().default(10),
    });

    app.post(
      '/demo',
      { preHandler: validateZod({ body: schema }) },
      async (request) => request.body,
    );

    const response = await app.inject({
      method: 'POST',
      url: '/demo',
      payload: { name: '  guitar  ', limit: '3' },
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(JSON.parse(response.body), { name: 'guitar', limit: 3 });
    await app.close();
  });

  it('rejects invalid params with ValidationError shape', async () => {
    const app = Fastify();
    app.setErrorHandler((error, _request, reply) => {
      if (error instanceof ValidationError) {
        return reply.status(error.statusCode).send({
          statusCode: error.statusCode,
          error: error.name,
          message: error.message,
        });
      }
      throw error;
    });

    app.get(
      '/items/:id',
      {
        preHandler: validateZod({
          params: z.object({ id: z.uuid() }),
        }),
      },
      async () => ({ ok: true }),
    );

    const response = await app.inject({
      method: 'GET',
      url: '/items/not-a-uuid',
    });

    assert.equal(response.statusCode, 400);
    const body = JSON.parse(response.body) as {
      error: string;
      message: string;
    };
    assert.equal(body.error, 'Bad Request');
    assert.match(body.message, /id/);
    await app.close();
  });
});

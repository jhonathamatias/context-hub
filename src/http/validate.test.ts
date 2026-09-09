import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { searchBodySchema, sourceIdParamsSchema } from '../http';
import { parseInput, ValidationError } from '../http/validate';

describe('parseInput', () => {
  it('accepts a valid sourceId param', () => {
    const parsed = parseInput(sourceIdParamsSchema, {
      sourceId: '512b014f-7c61-4e49-9511-970aecdea526',
    });
    assert.equal(parsed.sourceId, '512b014f-7c61-4e49-9511-970aecdea526');
  });

  it('rejects an invalid sourceId', () => {
    assert.throws(
      () => parseInput(sourceIdParamsSchema, { sourceId: 'not-a-uuid' }),
      (error: unknown) =>
        error instanceof ValidationError && error.statusCode === 400,
    );
  });

  it('validates search body and trims query', () => {
    const parsed = parseInput(searchBodySchema, {
      query: '  power chord  ',
      limit: '3',
    });
    assert.equal(parsed.query, 'power chord');
    assert.equal(parsed.limit, 3);
  });

  it('accepts sourceIds on search', () => {
    const parsed = parseInput(searchBodySchema, {
      query: 'lick',
      sourceIds: ['512b014f-7c61-4e49-9511-970aecdea526'],
    });
    assert.equal(parsed.sourceIds?.length, 1);
  });

  it('rejects empty search query', () => {
    assert.throws(
      () => parseInput(searchBodySchema, { query: '   ' }),
      ValidationError,
    );
  });
});

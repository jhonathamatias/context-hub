import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  classifyVideoProviderError,
  GEMINI_HIGH_DEMAND_RETRY_MESSAGE,
  publicMessageForAttempt,
} from './provider-error';

describe('classifyVideoProviderError', () => {
  it('treats 503 as retryable unavailable', () => {
    const classified = classifyVideoProviderError({
      status: 503,
      message: 'Service Unavailable — high demand',
    });
    assert.equal(classified.retryable, true);
    assert.equal(classified.category, 'unavailable');
    assert.equal(classified.publicMessage, GEMINI_HIGH_DEMAND_RETRY_MESSAGE);
  });

  it('parses @google/genai ApiError JSON message for 503', () => {
    const classified = classifyVideoProviderError({
      message: JSON.stringify({
        error: {
          code: 503,
          message: 'This model is currently experiencing high demand.',
          status: 'UNAVAILABLE',
        },
      }),
    });
    assert.equal(classified.retryable, true);
    assert.equal(classified.status, 503);
  });

  it('treats 429 as retryable rate_limit', () => {
    const classified = classifyVideoProviderError({
      status: 429,
      message: 'RESOURCE_EXHAUSTED',
    });
    assert.equal(classified.retryable, true);
    assert.equal(classified.category, 'rate_limit');
  });

  it('does not retry permanent auth errors', () => {
    const classified = classifyVideoProviderError({
      status: 401,
      message: 'API key not valid',
    });
    assert.equal(classified.retryable, false);
    assert.equal(classified.category, 'auth');
  });

  it('does not retry invalid request / schema failures', () => {
    const badRequest = classifyVideoProviderError({
      status: 400,
      message: 'Invalid argument: unsupported mime type',
    });
    assert.equal(badRequest.retryable, false);
    assert.equal(badRequest.category, 'invalid_request');

    const schema = classifyVideoProviderError(
      new Error('Knowledge payload failed schema validation: expected string'),
    );
    assert.equal(schema.retryable, false);
    assert.equal(schema.category, 'invalid_schema');
  });

  it('uses final public message when retries are exhausted', () => {
    const classified = classifyVideoProviderError({ status: 503, message: 'unavailable' });
    const message = publicMessageForAttempt(classified, false);
    assert.match(message, /Tente novamente/);
    assert.equal(message.includes('automaticamente'), false);
  });
});

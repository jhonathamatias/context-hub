import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isRetryableLlmError,
  withControlledRetries,
} from './retry';

describe('isRetryableLlmError', () => {
  it('retries rate limits and server errors', () => {
    assert.equal(isRetryableLlmError({ status: 429 }), true);
    assert.equal(isRetryableLlmError({ statusCode: 503 }), true);
    assert.equal(isRetryableLlmError({ status: 400 }), false);
  });

  it('retries timeout-like codes and messages', () => {
    assert.equal(isRetryableLlmError({ code: 'ETIMEDOUT' }), true);
    assert.equal(isRetryableLlmError({ message: 'Request timeout' }), true);
    assert.equal(isRetryableLlmError({ message: 'bad request' }), false);
  });
});

describe('withControlledRetries', () => {
  it('returns on first success', async () => {
    let calls = 0;
    const result = await withControlledRetries(
      async () => {
        calls += 1;
        return 'ok';
      },
      { maxRetries: 2, baseDelayMs: 1 },
    );
    assert.deepEqual(result, { value: 'ok', attempts: 1 });
    assert.equal(calls, 1);
  });

  it('retries retryable failures up to maxRetries', async () => {
    let calls = 0;
    const result = await withControlledRetries(
      async () => {
        calls += 1;
        if (calls === 1) {
          throw { status: 429 };
        }
        if (calls === 2) {
          throw { status: 503 };
        }
        return 'done';
      },
      { maxRetries: 2, baseDelayMs: 1 },
    );

    assert.deepEqual(result, { value: 'done', attempts: 3 });
    assert.equal(calls, 3);
  });

  it('does not retry non-retryable errors', async () => {
    let calls = 0;
    await assert.rejects(
      () =>
        withControlledRetries(
          async () => {
            calls += 1;
            throw { status: 400, message: 'bad' };
          },
          { maxRetries: 3, baseDelayMs: 1 },
        ),
      (error: unknown) =>
        typeof error === 'object' &&
        error !== null &&
        (error as { status?: number }).status === 400,
    );
    assert.equal(calls, 1);
  });
});

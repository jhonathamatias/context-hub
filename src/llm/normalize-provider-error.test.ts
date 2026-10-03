import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizeProviderError } from './normalize-provider-error';

describe('normalizeProviderError', () => {
  it('copies nested response status onto the error', () => {
    const err = Object.assign(new Error('rate limited'), {
      response: { status: 429, headers: { 'retry-after': '2' } },
    });
    try {
      normalizeProviderError(err);
      assert.fail('expected throw');
    } catch (normalized) {
      const n = normalized as Error & {
        status?: number;
        headers?: Record<string, string>;
      };
      assert.equal(n.status, 429);
      assert.equal(n.headers?.['retry-after'], '2');
    }
  });

  it('infers 429 from RESOURCE_EXHAUSTED message', () => {
    const err = new Error('RESOURCE_EXHAUSTED: quota exceeded');
    try {
      normalizeProviderError(err);
      assert.fail('expected throw');
    } catch (normalized) {
      assert.equal((normalized as { status?: number }).status, 429);
    }
  });
});

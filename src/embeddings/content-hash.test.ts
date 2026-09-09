import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  batchItems,
  hashEmbeddingContent,
  shouldSkipEmbedding,
} from './content-hash';

describe('hashEmbeddingContent', () => {
  it('is stable for the same text', () => {
    const a = hashEmbeddingContent('power chord on A');
    const b = hashEmbeddingContent('power chord on A');
    assert.equal(a, b);
    assert.equal(a.length, 64);
  });

  it('changes when content changes', () => {
    const a = hashEmbeddingContent('power chord on A');
    const b = hashEmbeddingContent('power chord on E');
    assert.notEqual(a, b);
  });
});

describe('shouldSkipEmbedding', () => {
  const existing = {
    model: 'gemini-embedding-001',
    dimension: 3072,
    contentHash: hashEmbeddingContent('lick in A minor'),
  };

  it('skips when model and content match', () => {
    assert.equal(
      shouldSkipEmbedding(existing, {
        model: 'gemini-embedding-001',
        dimension: null,
        contentHash: existing.contentHash,
      }),
      true,
    );
  });

  it('does not skip when content changed', () => {
    assert.equal(
      shouldSkipEmbedding(existing, {
        model: 'gemini-embedding-001',
        dimension: 3072,
        contentHash: hashEmbeddingContent('different text'),
      }),
      false,
    );
  });

  it('does not skip when model changed', () => {
    assert.equal(
      shouldSkipEmbedding(existing, {
        model: 'text-embedding-3-small',
        dimension: 3072,
        contentHash: existing.contentHash,
      }),
      false,
    );
  });

  it('does not skip when desired dimension differs', () => {
    assert.equal(
      shouldSkipEmbedding(existing, {
        model: 'gemini-embedding-001',
        dimension: 768,
        contentHash: existing.contentHash,
      }),
      false,
    );
  });
});

describe('batchItems', () => {
  it('splits items into fixed-size batches', () => {
    assert.deepEqual(batchItems([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  });

  it('rejects invalid batch sizes', () => {
    assert.throws(() => batchItems([1], 0), /batchSize must be >= 1/);
  });
});

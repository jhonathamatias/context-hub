import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildPartialCacheKey,
  hashChunkGroupContent,
} from './partial-cache-key';

describe('partial cache keys', () => {
  it('is stable for same content and changes when content changes', () => {
    const a = hashChunkGroupContent(['hello', 'world']);
    const b = hashChunkGroupContent(['hello', 'world']);
    const c = hashChunkGroupContent(['hello', 'other']);
    assert.equal(a, b);
    assert.notEqual(a, c);
  });

  it('includes source, range, hash, provider, and model', () => {
    const key1 = buildPartialCacheKey({
      sourceId: 's1',
      chunkStart: 0,
      chunkEnd: 4,
      contentHash: 'abc',
      provider: 'gemini',
      model: 'flash',
    });
    const key2 = buildPartialCacheKey({
      sourceId: 's1',
      chunkStart: 0,
      chunkEnd: 4,
      contentHash: 'abc',
      provider: 'ollama',
      model: 'flash',
    });
    assert.notEqual(key1, key2);
  });
});

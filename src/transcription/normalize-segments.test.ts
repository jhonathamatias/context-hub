import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizeSegments } from './normalize-segments';

describe('normalizeSegments', () => {
  it('maps provider segments into domain timestamps', () => {
    const segments = normalizeSegments([
      { start: 0.0, end: 1.2, text: ' Hello ' },
      { start: 1.2, end: 2.0, text: 'world' },
      { start: 2.0, end: 2.5, text: '   ' },
    ]);

    assert.deepEqual(segments, [
      { startSeconds: 0, endSeconds: 1.2, text: 'Hello' },
      { startSeconds: 1.2, endSeconds: 2, text: 'world' },
    ]);
  });

  it('returns an empty list when segments are missing', () => {
    assert.deepEqual(normalizeSegments(undefined), []);
  });
});

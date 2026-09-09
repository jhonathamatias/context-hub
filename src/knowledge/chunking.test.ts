import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildTranscriptChunks, normalizeTranscriptText } from './chunking';

describe('normalizeTranscriptText', () => {
  it('collapses whitespace without destroying words', () => {
    assert.equal(
      normalizeTranscriptText('  Hello   world ,  this  is  fine.  '),
      'Hello world, this is fine.',
    );
  });
});

describe('buildTranscriptChunks', () => {
  it('creates overlapping chunks with temporal bounds', () => {
    const chunks = buildTranscriptChunks(
      [
        { startSeconds: 0, endSeconds: 5, text: 'A'.repeat(200) },
        { startSeconds: 5, endSeconds: 10, text: 'B'.repeat(200) },
        { startSeconds: 10, endSeconds: 15, text: 'C'.repeat(200) },
        { startSeconds: 15, endSeconds: 20, text: 'D'.repeat(200) },
        { startSeconds: 20, endSeconds: 25, text: 'E'.repeat(200) },
      ],
      {
        targetChars: 450,
        overlapChars: 100,
        maxDurationSeconds: 90,
      },
    );

    assert.ok(chunks.length >= 2);
    assert.equal(chunks[0]?.startSeconds, 0);
    assert.ok((chunks[0]?.endSeconds ?? 0) > 0);
    assert.ok(chunks.every((chunk) => chunk.normalizedText.length > 0));
    assert.ok(
      (chunks[1]?.startSeconds ?? 0) < (chunks[0]?.endSeconds ?? 0),
      'expected temporal overlap between consecutive chunks',
    );
  });

  it('returns empty list for empty segments', () => {
    assert.deepEqual(buildTranscriptChunks([]), []);
  });
});

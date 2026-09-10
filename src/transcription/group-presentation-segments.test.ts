import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { groupTranscriptSegments } from '../transcription/group-presentation-segments';
import { DEFAULT_MUSICAL_GLOSSARY } from '../transcription/musical-glossary';

describe('groupTranscriptSegments', () => {
  it('groups consecutive short segments into ~20–40s blocks', () => {
    const segments = [
      { startSeconds: 2, endSeconds: 5, text: 'Então é legal' },
      { startSeconds: 7, endSeconds: 12, text: 'você ir encaixando' },
      { startSeconds: 13, endSeconds: 20, text: 'essas equivalências' },
      { startSeconds: 33, endSeconds: 40, text: 'Mas você faz um negócio legal' },
      { startSeconds: 41, endSeconds: 50, text: 'Eu me baseio no dó' },
    ];

    const blocks = groupTranscriptSegments(segments, {
      targetDurationSeconds: 25,
      maxDurationSeconds: 40,
      maxChars: 200,
    });

    assert.ok(blocks.length >= 2);
    assert.equal(blocks[0]!.startSeconds, 2);
    assert.ok(blocks[0]!.text.includes('equivalências'));
    assert.equal(blocks[1]!.startSeconds, 33);
  });

  it('does not invent timestamps', () => {
    const segments = [
      { startSeconds: 10, endSeconds: 12, text: 'a' },
      { startSeconds: 12, endSeconds: 15, text: 'b' },
    ];
    const [block] = groupTranscriptSegments(segments, {
      targetDurationSeconds: 60,
      maxDurationSeconds: 60,
      maxChars: 1000,
    });
    assert.equal(block!.startSeconds, 10);
    assert.equal(block!.endSeconds, 15);
  });
});

describe('DEFAULT_MUSICAL_GLOSSARY', () => {
  it('includes core musical terms for Whisper initial_prompt', () => {
    assert.match(DEFAULT_MUSICAL_GLOSSARY, /dó/);
    assert.match(DEFAULT_MUSICAL_GLOSSARY, /pentatônica/i);
    assert.match(DEFAULT_MUSICAL_GLOSSARY, /CAGED/);
    assert.match(DEFAULT_MUSICAL_GLOSSARY, /mixolídio/i);
  });
});

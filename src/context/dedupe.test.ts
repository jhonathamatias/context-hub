import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assembleContext } from './assemble';
import { filterAndDedupeHits, textOverlapRatio } from './dedupe';
import type { SemanticSearchHit } from '../search';

function hit(
  partial: Partial<SemanticSearchHit> &
    Pick<SemanticSearchHit, 'chunkId' | 'normalizedText' | 'score'>,
): SemanticSearchHit {
  return {
    embeddingId: partial.embeddingId ?? `emb-${partial.chunkId}`,
    chunkId: partial.chunkId,
    sourceId: partial.sourceId ?? 'source-1',
    sourceName: partial.sourceName ?? 'Aula de improvisação.mp4',
    transcriptionId: partial.transcriptionId ?? 'tr-1',
    chunkIndex: partial.chunkIndex ?? 0,
    text: partial.text ?? partial.normalizedText,
    normalizedText: partial.normalizedText,
    startSeconds: partial.startSeconds ?? 10,
    endSeconds: partial.endSeconds ?? 40,
    model: partial.model ?? 'test',
    dimension: partial.dimension ?? 8,
    distance: partial.distance ?? 1 - partial.score,
    score: partial.score,
  };
}

describe('textOverlapRatio', () => {
  it('detects near-duplicate passages', () => {
    const ratio = textOverlapRatio(
      'pratique improvisação com metrônomo lentamente',
      'pratique improvisação com metronomo lentamente hoje',
    );
    assert.ok(ratio > 0.5);
  });
});

describe('filterAndDedupeHits', () => {
  it('drops low scores and near duplicates', () => {
    const filtered = filterAndDedupeHits(
      [
        hit({
          chunkId: 'a',
          score: 0.7,
          normalizedText: 'o professor recomenda estudar improvisação diariamente',
        }),
        hit({
          chunkId: 'b',
          score: 0.65,
          normalizedText:
            'o professor recomenda estudar improvisacao diariamente com foco',
        }),
        hit({
          chunkId: 'c',
          score: 0.1,
          normalizedText: 'ajuste o volume do amplificador',
        }),
      ],
      { minScore: 0.28, dedupeOverlap: 0.5, maxPassages: 6 },
    );

    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]?.chunkId, 'a');
  });
});

describe('assembleContext', () => {
  it('builds numbered citations with timestamps', () => {
    const context = assembleContext(
      [
        hit({
          chunkId: 'a',
          score: 0.6,
          startSeconds: 65,
          endSeconds: 90,
          normalizedText: 'estude improvisação em andamento lento',
        }),
      ],
      { maxChars: 2000, minScore: 0.28 },
    );

    assert.equal(context.sufficientEvidence, true);
    assert.equal(context.passages[0]?.index, 1);
    assert.match(context.promptBlock, /tempo=1:05-1:30/);
    assert.match(context.promptBlock, /sourceId=source-1/);
  });

  it('marks insufficient evidence when empty', () => {
    const context = assembleContext([], { maxChars: 2000, minScore: 0.28 });
    assert.equal(context.sufficientEvidence, false);
  });
});

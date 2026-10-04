import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { HeuristicVisualCandidateDetector } from './heuristic-visual-candidate.detector';
import {
  computeVisualCoverageMetrics,
  resolveVideoDurationSeconds,
} from './metrics';
import { containsNormalizedPhrase, normalizeForMatch } from './normalize';
import { applyPadding, mergeCandidates } from './window';
import type { VisualCandidate } from './types';

describe('normalizeForMatch', () => {
  it('normalizes case and accents for matching', () => {
    assert.equal(normalizeForMatch('Olha Aqui'), 'olha aqui');
    assert.equal(normalizeForMatch('posição'), 'posicao');
    assert.equal(normalizeForMatch('  Essa   Escala  '), 'essa escala');
  });

  it('does not match phrases that are only substrings of longer words', () => {
    assert.equal(
      containsNormalizedPhrase('desse acorde ou sexta', 'esse acorde'),
      false,
    );
    assert.equal(
      containsNormalizedPhrase('nesse formato', 'esse formato'),
      false,
    );
    assert.equal(
      containsNormalizedPhrase('esse acorde aqui', 'esse acorde'),
      true,
    );
  });
});

describe('applyPadding', () => {
  it('applies 5s before and 15s after', () => {
    assert.deepEqual(applyPadding(270, 280), {
      startSeconds: 265,
      endSeconds: 295,
    });
  });

  it('never allows negative start', () => {
    assert.deepEqual(applyPadding(2, 8), {
      startSeconds: 0,
      endSeconds: 23,
    });
  });
});

describe('mergeCandidates', () => {
  it('merges overlapping intervals', () => {
    const merged = mergeCandidates([
      candidate(255, 275, ['a']),
      candidate(262, 282, ['b']),
      candidate(275, 295, ['c']),
    ]);
    assert.equal(merged.length, 1);
    assert.equal(merged[0]!.startSeconds, 255);
    assert.equal(merged[0]!.endSeconds, 295);
    assert.deepEqual(merged[0]!.triggers, ['a', 'b', 'c']);
  });

  it('merges near intervals within gap threshold', () => {
    const merged = mergeCandidates(
      [candidate(100, 120, ['a']), candidate(128, 150, ['b'])],
      10,
    );
    assert.equal(merged.length, 1);
    assert.equal(merged[0]!.startSeconds, 100);
    assert.equal(merged[0]!.endSeconds, 150);
  });

  it('keeps distant intervals separate', () => {
    const merged = mergeCandidates(
      [candidate(100, 120, ['a']), candidate(140, 160, ['b'])],
      10,
    );
    assert.equal(merged.length, 2);
  });
});

describe('computeVisualCoverageMetrics', () => {
  it('does not double-count overlapping spans after merge', () => {
    const metrics = computeVisualCoverageMetrics(
      [candidate(0, 40, ['a'])],
      100,
    );
    assert.equal(metrics.totalCandidateSeconds, 40);
    assert.equal(metrics.coveragePercent, 40);
    assert.equal(metrics.candidateCount, 1);
  });

  it('returns coherent metrics for empty candidates', () => {
    const metrics = computeVisualCoverageMetrics([], 500);
    assert.deepEqual(metrics, {
      videoDurationSeconds: 500,
      candidateCount: 0,
      totalCandidateSeconds: 0,
      coveragePercent: 0,
    });
  });

  it('resolves duration from segments when explicit missing', () => {
    assert.equal(
      resolveVideoDurationSeconds([
        { endSeconds: 10 },
        { endSeconds: 42.5 },
      ]),
      42.5,
    );
  });
});

describe('HeuristicVisualCandidateDetector', () => {
  const detector = new HeuristicVisualCandidateDetector();

  it('creates a candidate when a visual phrase is present', async () => {
    const candidates = await detector.detect([
      { startSeconds: 270, endSeconds: 280, text: 'Olha esse desenho aqui' },
    ]);
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0]!.startSeconds, 265);
    assert.equal(candidates[0]!.endSeconds, 295);
    assert.ok(candidates[0]!.triggers.includes('esse desenho'));
  });

  it('does not create a candidate for ordinary speech', async () => {
    const candidates = await detector.detect([
      {
        startSeconds: 10,
        endSeconds: 20,
        text: 'Então a teoria por trás disso é bem simples',
      },
    ]);
    assert.equal(candidates.length, 0);
  });

  it('matches accent and case variants', async () => {
    const candidates = await detector.detect([
      { startSeconds: 60, endSeconds: 70, text: 'OLHA ESSA POSIÇÃO da mão' },
    ]);
    assert.equal(candidates.length, 1);
    assert.ok(
      candidates[0]!.triggers.some((t) => t.includes('posicao')),
    );
  });

  it('merges nearby triggered segments into one window', async () => {
    const candidates = await detector.detect([
      { startSeconds: 100, endSeconds: 105, text: 'vou tocar agora' },
      { startSeconds: 110, endSeconds: 115, text: 'olha aqui o lick' },
    ]);
    // padded: [95,120] and [105,130] → merge
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0]!.startSeconds, 95);
    assert.equal(candidates[0]!.endSeconds, 130);
  });
});

function candidate(
  startSeconds: number,
  endSeconds: number,
  triggers: string[],
): VisualCandidate {
  return {
    startSeconds,
    endSeconds,
    reason: 'test',
    confidence: 0.7,
    triggers,
  };
}

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { computeRankingCoverageMetrics } from './ranking-metrics';
import { RuleBasedVisualCandidateRanker } from './rule-based-visual-candidate.ranker';
import type { VisualCandidate } from './types';

describe('RuleBasedVisualCandidateRanker', () => {
  const ranker = new RuleBasedVisualCandidateRanker();

  it('gives strong triggers a higher score than weak triggers', async () => {
    const ranked = await ranker.rank(
      [
        candidate(100, 120, ['esse desenho']),
        candidate(200, 220, ['vou tocar']),
      ],
      [
        seg(100, 120, 'olha esse desenho da penta'),
        seg(200, 220, 'agora vou tocar'),
      ],
    );

    const strong = ranked.find((c) => c.triggers.includes('esse desenho'))!;
    const weak = ranked.find((c) => c.triggers.includes('vou tocar'))!;
    assert.ok(strong.score > weak.score);
    assert.equal(strong.relevance, 'high');
  });

  it('increases score when multiple evidence categories combine', async () => {
    const [onlyWeak] = await ranker.rank(
      [candidate(10, 30, ['vou tocar'])],
      [seg(10, 30, 'vou tocar agora')],
    );
    const [combo] = await ranker.rank(
      [candidate(10, 40, ['vou tocar', 'nessa regiao'])],
      [
        seg(10, 20, 'vou tocar'),
        seg(20, 40, 'nessa região do braço'),
      ],
    );

    assert.ok(combo!.score > (onlyWeak?.score ?? 0));
    assert.ok(
      combo!.scoreReasons.some((r) => r.includes('multi-category')),
    );
  });

  it('does not inflate score for duplicate equivalent triggers', async () => {
    const [once] = await ranker.rank(
      [candidate(10, 30, ['nessa regiao'])],
      [seg(10, 30, 'nessa região')],
    );
    const [duped] = await ranker.rank(
      [candidate(10, 30, ['nessa regiao', 'nessa regiao'])],
      [seg(10, 30, 'nessa região nessa região')],
    );

    assert.equal(once!.score, duped!.score);
  });

  it('negates weak "vou tocar" evidence under "não vou tocar"', async () => {
    const [ranked] = await ranker.rank(
      [candidate(10, 30, ['vou tocar'])],
      [seg(10, 30, 'eu não vou tocar essa nota')],
    );

    assert.ok(ranked);
    assert.equal(ranked.score, 0);
    assert.equal(ranked.rejected, true);
    assert.ok(
      ranked.scoreReasons.some((r) => r.includes('negated weak evidence')),
    );
  });

  it('keeps independent strong evidence when a weak trigger is negated', async () => {
    const [ranked] = await ranker.rank(
      [candidate(10, 40, ['vou tocar', 'essa posicao'])],
      [
        seg(10, 20, 'eu não vou tocar essa nota'),
        seg(20, 40, 'olha essa posição aqui'),
      ],
    );

    assert.ok(ranked);
    assert.equal(ranked.rejected, false);
    assert.equal(ranked.relevance, 'high');
    assert.ok(ranked.score >= 3);
    assert.ok(
      ranked.scoreReasons.some((r) => r.includes('negated weak evidence')),
    );
    assert.ok(
      ranked.scoreReasons.some((r) => r.includes('essa posicao')),
    );
  });

  it('marks lone "faz assim" as rejected (or not high)', async () => {
    const [ranked] = await ranker.rank(
      [candidate(10, 30, ['faz assim'])],
      [
        seg(
          10,
          30,
          'que você faz assim de uma forma que faz sentido e tal',
        ),
      ],
    );

    assert.ok(ranked);
    assert.equal(ranked.rejected, true);
    assert.notEqual(ranked.relevance, 'high');
    assert.ok(ranked.rejectionReasons.length > 0);
  });

  it('marks "esse desenho" as HIGH', async () => {
    const [ranked] = await ranker.rank(
      [candidate(50, 70, ['esse desenho'])],
      [seg(50, 70, 'justamente por esse desenho da penta')],
    );

    assert.ok(ranked);
    assert.equal(ranked.rejected, false);
    assert.equal(ranked.relevance, 'high');
    assert.ok(ranked.score >= 3);
  });

  it('scores spatial + demonstration higher than demonstration alone', async () => {
    const [demo] = await ranker.rank(
      [candidate(1, 20, ['vou mostrar'])],
      [seg(1, 20, 'vou mostrar agora')],
    );
    const [both] = await ranker.rank(
      [candidate(1, 30, ['vou mostrar', 'nesse formato'])],
      [
        seg(1, 15, 'vou mostrar'),
        seg(15, 30, 'nesse formato'),
      ],
    );

    assert.ok((both?.score ?? 0) > (demo?.score ?? 0));
  });

  it('orders candidates by score descending with deterministic ties', async () => {
    const ranked = await ranker.rank(
      [
        candidate(300, 320, ['vou tocar']),
        candidate(100, 120, ['esse desenho']),
        candidate(50, 70, ['nessa regiao']),
      ],
      [
        seg(50, 70, 'nessa região'),
        seg(100, 120, 'esse desenho'),
        seg(300, 320, 'vou tocar aleatoriamente sem motivo'),
      ],
    );

    assert.ok(ranked[0]!.score >= ranked[1]!.score);
    assert.ok(ranked[1]!.score >= ranked[2]!.score);

    const tied = await ranker.rank(
      [
        candidate(200, 220, ['nessa regiao']),
        candidate(100, 120, ['esse desenho']),
      ],
      [
        seg(100, 120, 'esse desenho'),
        seg(200, 220, 'nessa região'),
      ],
    );
    // same strong weight → earlier start first
    assert.equal(tied[0]!.startSeconds, 100);
    assert.equal(tied[1]!.startSeconds, 200);
  });

  it('includes explainable score reasons', async () => {
    const [ranked] = await ranker.rank(
      [candidate(10, 30, ['esse formato'])],
      [seg(10, 30, 'poderia ter esse formato')],
    );
    assert.ok(ranked);
    assert.ok(ranked.scoreReasons.length > 0);
    assert.ok(ranked.scoreReasons.some((r) => r.startsWith('+')));
  });

  it('handles an empty candidate list', async () => {
    const ranked = await ranker.rank([], []);
    assert.deepEqual(ranked, []);
  });
});

describe('computeRankingCoverageMetrics', () => {
  it('computes HIGH/MEDIUM/LOW/REJECTED metrics without double-count', () => {
    const original: VisualCandidate[] = [
      candidate(0, 40, ['esse desenho']),
      candidate(100, 130, ['desse acorde']),
      candidate(200, 220, ['faz assim']),
    ];

    const ranked = [
      {
        ...original[0]!,
        score: 3,
        relevance: 'high' as const,
        scoreReasons: ['+3'],
        rejected: false,
        rejectionReasons: [],
        contextSnippet: '',
      },
      {
        ...original[1]!,
        score: 2,
        relevance: 'medium' as const,
        scoreReasons: ['+2'],
        rejected: false,
        rejectionReasons: [],
        contextSnippet: '',
      },
      {
        ...original[2]!,
        score: 1,
        relevance: 'low' as const,
        scoreReasons: ['+1'],
        rejected: true,
        rejectionReasons: ['weak only'],
        contextSnippet: '',
      },
    ];

    const metrics = computeRankingCoverageMetrics(original, ranked, 400);
    assert.equal(metrics.originalCandidateCount, 3);
    assert.equal(metrics.originalCandidateSeconds, 90);
    assert.equal(metrics.highCandidateCount, 1);
    assert.equal(metrics.highCandidateSeconds, 40);
    assert.equal(metrics.mediumCandidateCount, 1);
    assert.equal(metrics.mediumCandidateSeconds, 30);
    assert.equal(metrics.lowCandidateCount, 0);
    assert.equal(metrics.rejectedCandidateCount, 1);
    assert.equal(metrics.highMediumCandidateCount, 2);
    assert.equal(metrics.highMediumCandidateSeconds, 70);
    assert.equal(metrics.highMediumCoveragePercent, (70 / 400) * 100);
  });

  it('returns zeros for empty inputs', () => {
    const metrics = computeRankingCoverageMetrics([], [], 100);
    assert.equal(metrics.originalCandidateCount, 0);
    assert.equal(metrics.highMediumCoveragePercent, 0);
    assert.equal(metrics.rejectedCandidateCount, 0);
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
    confidence: 0.65,
    triggers,
  };
}

function seg(
  startSeconds: number,
  endSeconds: number,
  text: string,
): { startSeconds: number; endSeconds: number; text: string } {
  return { startSeconds, endSeconds, text };
}

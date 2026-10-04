import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  aggregateRemoteAccess,
  aggregateTokens,
} from './metrics';
import { selectTop3, clipDurationSeconds } from './top3';
import { mapAbsoluteRange, toAbsoluteSeconds } from './timestamps';
import { classifyFinding } from './visual-clip-analyzer';

describe('Top 3 selection', () => {
  it('selects the three hard-coded ranking windows', () => {
    const top = selectTop3();
    assert.equal(top.length, 3);
    assert.deepEqual(
      top.map((w) => [w.startSeconds, w.endSeconds]),
      [
        [36 * 60 + 39, 37 * 60 + 33],
        [31 * 60 + 57, 32 * 60 + 19],
        [32 * 60 + 35, 32 * 60 + 57],
      ],
    );
    assert.equal(
      top.reduce((s, w) => s + clipDurationSeconds(w), 0),
      54 + 22 + 22,
    );
  });
});

describe('absolute timestamps', () => {
  it('converts relative clip times to absolute lesson times', () => {
    assert.equal(toAbsoluteSeconds(100, 5), 105);
    assert.equal(toAbsoluteSeconds(100, null), null);
    assert.deepEqual(mapAbsoluteRange(2200, 2, 10), {
      absoluteStart: 2202,
      absoluteEnd: 2210,
    });
  });
});

describe('metrics aggregation', () => {
  it('aggregates clip bytes and transfer ratio without double-count', () => {
    const summary = aggregateRemoteAccess({
      originalVideoBytes: 1_000_000,
      fullDownloadAvoided: 'YES',
      remoteSeekResult: 'SIMULATED',
      clips: [
        {
          rank: 1,
          startSeconds: 1,
          endSeconds: 2,
          durationSeconds: 1,
          outputBytes: 1000,
          transferredBytes: 50_000,
          extractionDurationMs: 10,
          outputPath: '/tmp/a',
          usedCopyCodec: true,
        },
        {
          rank: 2,
          startSeconds: 3,
          endSeconds: 4,
          durationSeconds: 1,
          outputBytes: 2000,
          transferredBytes: 30_000,
          extractionDurationMs: 20,
          outputPath: '/tmp/b',
          usedCopyCodec: true,
        },
      ],
    });
    assert.equal(summary.clipOutputBytes, 3000);
    assert.equal(summary.transferredBytes, 80_000);
    assert.equal(summary.transferRatioPercent, 8);
    assert.equal(summary.outputRatioPercent, 0.3);
  });

  it('marks transfer null when any clip lacks measurement', () => {
    const summary = aggregateRemoteAccess({
      originalVideoBytes: 100,
      fullDownloadAvoided: 'UNPROVEN',
      remoteSeekResult: 'FAILED',
      clips: [
        {
          rank: 1,
          startSeconds: 0,
          endSeconds: 1,
          durationSeconds: 1,
          outputBytes: 10,
          transferredBytes: null,
          extractionDurationMs: 1,
          outputPath: '/tmp/a',
          usedCopyCodec: false,
        },
      ],
    });
    assert.equal(summary.transferredBytes, null);
    assert.equal(summary.transferRatioPercent, null);
  });

  it('aggregates tokens vs baselines', () => {
    const agg = aggregateTokens([
      { inputTokens: 1000, outputTokens: 100, totalTokens: 1100 },
      { inputTokens: 2000, outputTokens: 200, totalTokens: 2200 },
    ]);
    assert.equal(agg.totalTokens, 3300);
    assert.ok(agg.ratioVs384kPercent != null);
    assert.ok((agg.ratioVs384kPercent ?? 0) < 5);
    assert.ok((agg.reductionVs384kPercent ?? 0) > 90);
  });

  it('handles missing token telemetry', () => {
    const agg = aggregateTokens([{ totalTokens: null }, { totalTokens: 10 }]);
    assert.equal(agg.totalTokens, null);
    assert.equal(agg.ratioVs384kPercent, null);
  });
});

describe('finding classification', () => {
  it('marks concrete fretboard detail as new visual info', () => {
    assert.equal(
      classifyFinding(
        'shape da pentatonica na casa 5 corda 3',
        'vou usar esse desenho da pentatonica',
      ),
      'NEW_VISUAL_INFORMATION',
    );
  });

  it('marks near paraphrase without visual detail as duplicate', () => {
    assert.equal(
      classifyFinding(
        'o professor demonstra um desenho da pentatonica',
        'vou usar esse desenho da pentatonica',
      ),
      'DUPLICATE_OF_TRANSCRIPT',
    );
  });
});

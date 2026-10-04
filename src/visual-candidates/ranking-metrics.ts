import { computeVisualCoverageMetrics } from './metrics';
import type {
  RankedVisualCandidate,
  RankingCoverageMetrics,
  VisualCandidate,
  VisualCoverageMetrics,
} from './types';

export function computeRankingCoverageMetrics(
  original: VisualCandidate[],
  ranked: RankedVisualCandidate[],
  videoDurationSeconds: number,
): RankingCoverageMetrics {
  const base: VisualCoverageMetrics = computeVisualCoverageMetrics(
    original,
    videoDurationSeconds,
  );

  const kept = ranked.filter((c) => !c.rejected);
  const high = kept.filter((c) => c.relevance === 'high');
  const medium = kept.filter((c) => c.relevance === 'medium');
  const low = kept.filter((c) => c.relevance === 'low');
  const rejected = ranked.filter((c) => c.rejected);
  const highMedium = [...high, ...medium];

  const highMetrics = computeVisualCoverageMetrics(high, videoDurationSeconds);
  const mediumMetrics = computeVisualCoverageMetrics(
    medium,
    videoDurationSeconds,
  );
  const lowMetrics = computeVisualCoverageMetrics(low, videoDurationSeconds);
  const rejectedMetrics = computeVisualCoverageMetrics(
    rejected,
    videoDurationSeconds,
  );
  const highMediumMetrics = computeVisualCoverageMetrics(
    highMedium,
    videoDurationSeconds,
  );

  return {
    originalCandidateCount: base.candidateCount,
    originalCandidateSeconds: base.totalCandidateSeconds,
    originalCoveragePercent: base.coveragePercent,

    highCandidateCount: highMetrics.candidateCount,
    highCandidateSeconds: highMetrics.totalCandidateSeconds,
    highCoveragePercent: highMetrics.coveragePercent,

    mediumCandidateCount: mediumMetrics.candidateCount,
    mediumCandidateSeconds: mediumMetrics.totalCandidateSeconds,
    mediumCoveragePercent: mediumMetrics.coveragePercent,

    lowCandidateCount: lowMetrics.candidateCount,
    lowCandidateSeconds: lowMetrics.totalCandidateSeconds,
    lowCoveragePercent: lowMetrics.coveragePercent,

    rejectedCandidateCount: rejectedMetrics.candidateCount,
    rejectedCandidateSeconds: rejectedMetrics.totalCandidateSeconds,

    highMediumCandidateCount: highMediumMetrics.candidateCount,
    highMediumCandidateSeconds: highMediumMetrics.totalCandidateSeconds,
    highMediumCoveragePercent: highMediumMetrics.coveragePercent,
  };
}

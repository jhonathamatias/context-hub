import type { VisualCandidate, VisualCoverageMetrics } from './types';

export function computeVisualCoverageMetrics(
  candidates: VisualCandidate[],
  videoDurationSeconds: number,
): VisualCoverageMetrics {
  const duration = Math.max(0, videoDurationSeconds);
  const totalCandidateSeconds = candidates.reduce((sum, candidate) => {
    const span = Math.max(0, candidate.endSeconds - candidate.startSeconds);
    return sum + span;
  }, 0);

  const coveragePercent =
    duration > 0 ? (totalCandidateSeconds / duration) * 100 : 0;

  return {
    videoDurationSeconds: duration,
    candidateCount: candidates.length,
    totalCandidateSeconds,
    coveragePercent,
  };
}

/** Prefer explicit duration; else last segment end. */
export function resolveVideoDurationSeconds(
  segments: Array<{ endSeconds: number }>,
  explicitDurationSeconds?: number,
): number {
  if (
    explicitDurationSeconds != null &&
    Number.isFinite(explicitDurationSeconds) &&
    explicitDurationSeconds > 0
  ) {
    return explicitDurationSeconds;
  }
  let maxEnd = 0;
  for (const segment of segments) {
    if (segment.endSeconds > maxEnd) maxEnd = segment.endSeconds;
  }
  return maxEnd;
}

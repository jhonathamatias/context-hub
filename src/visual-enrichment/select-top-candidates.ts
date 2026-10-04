import type { RankedVisualCandidate } from '../visual-candidates';

/**
 * Select up to `topN` non-rejected ranked candidates (prefer high, then medium).
 * Deterministic — no LLM.
 */
export function selectTopVisualCandidates(
  ranked: RankedVisualCandidate[],
  topN: number,
): RankedVisualCandidate[] {
  if (topN <= 0) return [];
  const kept = ranked.filter((c) => !c.rejected);
  const high = kept.filter((c) => c.relevance === 'high');
  const medium = kept.filter((c) => c.relevance === 'medium');
  const ordered = [...high, ...medium, ...kept.filter((c) => c.relevance === 'low')];
  // Prefer score order within the kept set while still biasing high→medium.
  const byScore = [...kept].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.startSeconds - b.startSeconds;
  });
  const preferred = byScore.length > 0 ? byScore : ordered;
  return preferred.slice(0, topN);
}

export { HeuristicVisualCandidateDetector } from './heuristic-visual-candidate.detector';
export { RuleBasedVisualCandidateRanker } from './rule-based-visual-candidate.ranker';
export {
  computeVisualCoverageMetrics,
  resolveVideoDurationSeconds,
} from './metrics';
export { computeRankingCoverageMetrics } from './ranking-metrics';
export { containsNormalizedPhrase, normalizeForMatch } from './normalize';
export { loadWhisperTranscription } from './load-transcription';
export type { LoadedWhisperTranscription } from './load-transcription';
export { formatClock, formatDurationLabel } from './format';
export { formatVisualCandidatesReport } from './report';
export { VISUAL_TRIGGERS } from './triggers';
export type { VisualTrigger } from './triggers';
export {
  SCORED_PHRASES,
  RELEVANCE_HIGH_MIN,
  RELEVANCE_MEDIUM_MIN,
} from './scoring-weights';
export {
  applyPadding,
  mergeCandidates,
  DEFAULT_PAD_BEFORE_SECONDS,
  DEFAULT_PAD_AFTER_SECONDS,
  DEFAULT_MERGE_GAP_SECONDS,
} from './window';
export type {
  VisualCandidate,
  VisualCandidateDetector,
  VisualCandidateDetectorOptions,
  VisualCandidateRanker,
  VisualCoverageMetrics,
  RankedVisualCandidate,
  RankingCoverageMetrics,
  VisualRelevance,
} from './types';

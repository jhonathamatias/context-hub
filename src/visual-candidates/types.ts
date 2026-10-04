import type { TranscriptionSegment } from '../transcription/types';

export type VisualCandidate = {
  startSeconds: number;
  endSeconds: number;
  /** Human-readable explanation of why this window was selected. */
  reason: string;
  /** 0..1 heuristic confidence (not a model score). */
  confidence: number;
  /** Matched transcript phrases that triggered detection. */
  triggers: string[];
};

export type VisualCoverageMetrics = {
  videoDurationSeconds: number;
  candidateCount: number;
  totalCandidateSeconds: number;
  coveragePercent: number;
};

export type VisualRelevance = 'high' | 'medium' | 'low';

export type RankedVisualCandidate = VisualCandidate & {
  score: number;
  relevance: VisualRelevance;
  scoreReasons: string[];
  rejected: boolean;
  rejectionReasons: string[];
  /** Short transcript snippet from the candidate window (for reports). */
  contextSnippet: string;
};

export type RankingCoverageMetrics = {
  originalCandidateCount: number;
  originalCandidateSeconds: number;
  originalCoveragePercent: number;

  highCandidateCount: number;
  highCandidateSeconds: number;
  highCoveragePercent: number;

  mediumCandidateCount: number;
  mediumCandidateSeconds: number;
  mediumCoveragePercent: number;

  lowCandidateCount: number;
  lowCandidateSeconds: number;
  lowCoveragePercent: number;

  rejectedCandidateCount: number;
  rejectedCandidateSeconds: number;

  highMediumCandidateCount: number;
  highMediumCandidateSeconds: number;
  highMediumCoveragePercent: number;
};

export interface VisualCandidateDetector {
  detect(segments: TranscriptionSegment[]): Promise<VisualCandidate[]>;
}

export interface VisualCandidateRanker {
  rank(
    candidates: VisualCandidate[],
    segments: TranscriptionSegment[],
  ): Promise<RankedVisualCandidate[]>;
}

export type VisualCandidateDetectorOptions = {
  /** Seconds to expand before a matched segment. Default 5. */
  padBeforeSeconds?: number;
  /** Seconds to expand after a matched segment. Default 15. */
  padAfterSeconds?: number;
  /** Merge candidates closer than this gap (seconds). Default 10. */
  mergeGapSeconds?: number;
};

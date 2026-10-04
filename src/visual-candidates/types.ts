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

export interface VisualCandidateDetector {
  detect(segments: TranscriptionSegment[]): Promise<VisualCandidate[]>;
}

export type VisualCandidateDetectorOptions = {
  /** Seconds to expand before a matched segment. Default 5. */
  padBeforeSeconds?: number;
  /** Seconds to expand after a matched segment. Default 15. */
  padAfterSeconds?: number;
  /** Merge candidates closer than this gap (seconds). Default 10. */
  mergeGapSeconds?: number;
};

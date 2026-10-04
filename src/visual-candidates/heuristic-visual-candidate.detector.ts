import type { TranscriptionSegment } from '../transcription/types';
import { containsNormalizedPhrase, normalizeForMatch } from './normalize';
import { VISUAL_TRIGGERS } from './triggers';
import type {
  VisualCandidate,
  VisualCandidateDetector,
  VisualCandidateDetectorOptions,
} from './types';
import {
  DEFAULT_MERGE_GAP_SECONDS,
  DEFAULT_PAD_AFTER_SECONDS,
  DEFAULT_PAD_BEFORE_SECONDS,
  applyPadding,
  mergeCandidates,
} from './window';

/**
 * Deterministic local detector: phrase heuristics on Whisper segments.
 * No network, no paid APIs.
 */
export class HeuristicVisualCandidateDetector implements VisualCandidateDetector {
  private readonly padBeforeSeconds: number;
  private readonly padAfterSeconds: number;
  private readonly mergeGapSeconds: number;

  constructor(options: VisualCandidateDetectorOptions = {}) {
    this.padBeforeSeconds =
      options.padBeforeSeconds ?? DEFAULT_PAD_BEFORE_SECONDS;
    this.padAfterSeconds = options.padAfterSeconds ?? DEFAULT_PAD_AFTER_SECONDS;
    this.mergeGapSeconds = options.mergeGapSeconds ?? DEFAULT_MERGE_GAP_SECONDS;
  }

  async detect(segments: TranscriptionSegment[]): Promise<VisualCandidate[]> {
    const raw: VisualCandidate[] = [];

    for (const segment of segments) {
      const matches = matchTriggers(segment.text);
      if (matches.length === 0) continue;

      const padded = applyPadding(
        segment.startSeconds,
        segment.endSeconds,
        this.padBeforeSeconds,
        this.padAfterSeconds,
      );

      raw.push({
        startSeconds: padded.startSeconds,
        endSeconds: padded.endSeconds,
        reason: matches.map((m) => m.reason).join('; '),
        confidence: confidenceForMatchCount(matches.length),
        triggers: matches.map((m) => m.phrase),
      });
    }

    return mergeCandidates(raw, this.mergeGapSeconds);
  }
}

function matchTriggers(
  text: string,
): Array<{ phrase: string; reason: string }> {
  const normalized = normalizeForMatch(text);
  if (!normalized) return [];

  const hits: Array<{ phrase: string; reason: string }> = [];
  for (const trigger of VISUAL_TRIGGERS) {
    if (containsNormalizedPhrase(normalized, trigger.phrase)) {
      hits.push({ phrase: trigger.phrase, reason: trigger.reason });
    }
  }
  return hits;
}

function confidenceForMatchCount(count: number): number {
  if (count <= 0) return 0;
  return Math.min(1, 0.65 + 0.1 * (count - 1));
}

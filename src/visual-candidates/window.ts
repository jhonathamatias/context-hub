import type { VisualCandidate } from './types';

export const DEFAULT_PAD_BEFORE_SECONDS = 5;
export const DEFAULT_PAD_AFTER_SECONDS = 15;
export const DEFAULT_MERGE_GAP_SECONDS = 10;

export function applyPadding(
  startSeconds: number,
  endSeconds: number,
  padBeforeSeconds = DEFAULT_PAD_BEFORE_SECONDS,
  padAfterSeconds = DEFAULT_PAD_AFTER_SECONDS,
): { startSeconds: number; endSeconds: number } {
  return {
    startSeconds: Math.max(0, startSeconds - padBeforeSeconds),
    endSeconds: endSeconds + padAfterSeconds,
  };
}

/**
 * Merge overlapping or near candidates (gap ≤ mergeGapSeconds).
 * Input need not be sorted; output is sorted by start.
 */
export function mergeCandidates(
  candidates: VisualCandidate[],
  mergeGapSeconds = DEFAULT_MERGE_GAP_SECONDS,
): VisualCandidate[] {
  if (candidates.length === 0) return [];

  const sorted = [...candidates].sort(
    (a, b) => a.startSeconds - b.startSeconds || a.endSeconds - b.endSeconds,
  );

  const merged: VisualCandidate[] = [];
  let current = cloneCandidate(sorted[0]!);

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i]!;
    const gap = next.startSeconds - current.endSeconds;
    if (gap <= mergeGapSeconds) {
      current = {
        startSeconds: Math.min(current.startSeconds, next.startSeconds),
        endSeconds: Math.max(current.endSeconds, next.endSeconds),
        reason: joinUnique(current.reason, next.reason),
        confidence: Math.max(current.confidence, next.confidence),
        triggers: uniqueStrings([...current.triggers, ...next.triggers]),
      };
    } else {
      merged.push(current);
      current = cloneCandidate(next);
    }
  }
  merged.push(current);
  return merged;
}

function cloneCandidate(candidate: VisualCandidate): VisualCandidate {
  return {
    startSeconds: candidate.startSeconds,
    endSeconds: candidate.endSeconds,
    reason: candidate.reason,
    confidence: candidate.confidence,
    triggers: [...candidate.triggers],
  };
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const key = value.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

function joinUnique(a: string, b: string): string {
  return uniqueStrings([
    ...a.split(';').map((s) => s.trim()),
    ...b.split(';').map((s) => s.trim()),
  ]).join('; ');
}

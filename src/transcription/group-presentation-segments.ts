/**
 * Presentation-only grouping of transcript segments.
 * Deterministic, zero LLM tokens. Does not mutate persisted segments.
 */

export type GroupableSegment = {
  startSeconds: number;
  endSeconds: number;
  text: string;
};

export type TranscriptPresentationBlock = {
  startSeconds: number;
  endSeconds: number;
  text: string;
  segmentCount: number;
};

export type GroupTranscriptOptions = {
  /** Soft target duration per block (default 30s). */
  targetDurationSeconds?: number;
  /** Hard max duration before forcing a split (default 40s). */
  maxDurationSeconds?: number;
  /** Soft max characters before preferring a split (default 420). */
  maxChars?: number;
};

export function groupTranscriptSegments(
  segments: readonly GroupableSegment[],
  options: GroupTranscriptOptions = {},
): TranscriptPresentationBlock[] {
  const targetDuration = options.targetDurationSeconds ?? 30;
  const maxDuration = options.maxDurationSeconds ?? 40;
  const maxChars = options.maxChars ?? 420;

  if (segments.length === 0) {
    return [];
  }

  const blocks: TranscriptPresentationBlock[] = [];
  let startSeconds = segments[0]!.startSeconds;
  let endSeconds = segments[0]!.endSeconds;
  let texts: string[] = [];
  let segmentCount = 0;

  const flush = () => {
    if (segmentCount === 0) {
      return;
    }
    blocks.push({
      startSeconds,
      endSeconds,
      text: texts.join(' ').replace(/\s+/g, ' ').trim(),
      segmentCount,
    });
    texts = [];
    segmentCount = 0;
  };

  for (const segment of segments) {
    const text = segment.text.trim();
    if (!text) {
      continue;
    }

    if (segmentCount === 0) {
      startSeconds = segment.startSeconds;
      endSeconds = segment.endSeconds;
      texts = [text];
      segmentCount = 1;
      continue;
    }

    const nextEnd = Math.max(endSeconds, segment.endSeconds);
    const nextDuration = nextEnd - startSeconds;
    const nextChars = texts.join(' ').length + 1 + text.length;
    const gapSeconds = segment.startSeconds - endSeconds;

    const shouldSplit =
      gapSeconds > 8 ||
      nextDuration > maxDuration ||
      (nextDuration >= targetDuration && nextChars >= maxChars * 0.6) ||
      nextChars > maxChars;

    if (shouldSplit) {
      flush();
      startSeconds = segment.startSeconds;
      endSeconds = segment.endSeconds;
      texts = [text];
      segmentCount = 1;
      continue;
    }

    endSeconds = nextEnd;
    texts.push(text);
    segmentCount += 1;
  }

  flush();
  return blocks;
}

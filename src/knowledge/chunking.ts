import type { TranscriptionSegment } from '../transcription/types';

export type TranscriptChunkDraft = {
  chunkIndex: number;
  text: string;
  normalizedText: string;
  startSeconds: number;
  endSeconds: number;
};

export type ChunkingOptions = {
  /** Soft target size for each chunk in characters. */
  targetChars?: number;
  /** Overlap between consecutive chunks in characters. */
  overlapChars?: number;
  /** Max duration per chunk in seconds. */
  maxDurationSeconds?: number;
};

export function normalizeTranscriptText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.!?;:])/g, '$1')
    .trim();
}

/**
 * Builds searchable chunks from timestamped segments with moderate overlap.
 * Original segment wording is preserved in `text`; `normalizedText` is cleaned.
 */
export function buildTranscriptChunks(
  segments: TranscriptionSegment[],
  options: ChunkingOptions = {},
): TranscriptChunkDraft[] {
  const targetChars = options.targetChars ?? 900;
  const overlapChars = options.overlapChars ?? 120;
  const maxDurationSeconds = options.maxDurationSeconds ?? 90;

  const usable = segments
    .map((segment) => ({
      ...segment,
      text: segment.text.trim(),
    }))
    .filter((segment) => segment.text.length > 0);

  if (usable.length === 0) {
    return [];
  }

  const chunks: TranscriptChunkDraft[] = [];
  let startIndex = 0;

  while (startIndex < usable.length) {
    let endIndex = startIndex;
    let charCount = 0;
    let startSeconds = usable[startIndex]!.startSeconds;
    let endSeconds = usable[startIndex]!.endSeconds;

    while (endIndex < usable.length) {
      const candidate = usable[endIndex]!;
      const nextCount = charCount + candidate.text.length + (charCount > 0 ? 1 : 0);
      const nextDuration = candidate.endSeconds - startSeconds;

      if (
        endIndex > startIndex &&
        (nextCount > targetChars || nextDuration > maxDurationSeconds)
      ) {
        break;
      }

      charCount = nextCount;
      endSeconds = candidate.endSeconds;
      endIndex += 1;
    }

    if (endIndex === startIndex) {
      endIndex = startIndex + 1;
      endSeconds = usable[startIndex]!.endSeconds;
    }

    const slice = usable.slice(startIndex, endIndex);
    const text = slice.map((segment) => segment.text).join(' ');
    chunks.push({
      chunkIndex: chunks.length,
      text,
      normalizedText: normalizeTranscriptText(text),
      startSeconds,
      endSeconds,
    });

    if (endIndex >= usable.length) {
      break;
    }

    // Walk back for overlap by characters.
    let overlap = 0;
    let nextStart = endIndex - 1;
    while (nextStart > startIndex && overlap < overlapChars) {
      overlap += usable[nextStart]!.text.length;
      nextStart -= 1;
    }
    startIndex = Math.max(startIndex + 1, nextStart + 1);
  }

  return chunks;
}

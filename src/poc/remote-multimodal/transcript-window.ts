import type { TranscriptionSegment } from '../../transcription/types';

export function segmentsInWindow(
  segments: TranscriptionSegment[],
  startSeconds: number,
  endSeconds: number,
): TranscriptionSegment[] {
  return segments.filter(
    (s) => s.endSeconds >= startSeconds && s.startSeconds <= endSeconds,
  );
}

export function joinSegmentText(segments: TranscriptionSegment[]): string {
  return segments
    .map((s) => s.text.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

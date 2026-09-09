import type { TranscriptionSegment } from './types';

type RawSegment = {
  start?: number;
  end?: number;
  text?: string;
};

export function normalizeSegments(
  segments: RawSegment[] | undefined,
): TranscriptionSegment[] {
  if (!segments) {
    return [];
  }

  return segments
    .map((segment) => ({
      startSeconds: Number(segment.start ?? 0),
      endSeconds: Number(segment.end ?? 0),
      text: (segment.text ?? '').trim(),
    }))
    .filter((segment) => segment.text.length > 0);
}

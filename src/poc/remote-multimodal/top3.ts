/** Hard-coded Top 3 from visual ranking POC — do not expand. */
export type ClipWindow = {
  rank: number;
  startSeconds: number;
  endSeconds: number;
  score: number;
  label: string;
};

export const TOP3_CLIP_WINDOWS: readonly ClipWindow[] = [
  {
    rank: 1,
    startSeconds: 36 * 60 + 39,
    endSeconds: 37 * 60 + 33,
    score: 7,
    label: '36:39-37:33',
  },
  {
    rank: 2,
    startSeconds: 31 * 60 + 57,
    endSeconds: 32 * 60 + 19,
    score: 5,
    label: '31:57-32:19',
  },
  {
    rank: 3,
    startSeconds: 32 * 60 + 35,
    endSeconds: 32 * 60 + 57,
    score: 5,
    label: '32:35-32:57',
  },
] as const;

export function clipDurationSeconds(window: ClipWindow): number {
  return Math.max(0, window.endSeconds - window.startSeconds);
}

export function selectTop3(): ClipWindow[] {
  return [...TOP3_CLIP_WINDOWS];
}

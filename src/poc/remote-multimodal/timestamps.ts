/** Convert clip-relative seconds to absolute lesson timestamps. */
export function toAbsoluteSeconds(
  clipStartSeconds: number,
  relativeSeconds: number | undefined | null,
): number | null {
  if (relativeSeconds == null || !Number.isFinite(relativeSeconds)) return null;
  return clipStartSeconds + relativeSeconds;
}

export function mapAbsoluteRange(
  clipStartSeconds: number,
  relativeStart?: number | null,
  relativeEnd?: number | null,
): { absoluteStart: number | null; absoluteEnd: number | null } {
  return {
    absoluteStart: toAbsoluteSeconds(clipStartSeconds, relativeStart),
    absoluteEnd: toAbsoluteSeconds(clipStartSeconds, relativeEnd),
  };
}

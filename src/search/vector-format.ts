/**
 * Formats a float vector as a pgvector literal: [0.1,0.2,...]
 * Kept free of SQL operators so domain/tests stay provider-agnostic.
 */
export function toVectorLiteral(values: number[]): string {
  if (values.length === 0) {
    throw new Error('Cannot format an empty embedding vector');
  }

  for (const value of values) {
    if (!Number.isFinite(value)) {
      throw new Error('Embedding vector contains a non-finite number');
    }
  }

  return `[${values.join(',')}]`;
}

/** Cosine distance (0 = identical) → similarity score in [0, 1+] clipped for display. */
export function cosineDistanceToScore(distance: number): number {
  if (!Number.isFinite(distance)) {
    return 0;
  }
  return 1 - distance;
}

import { createHash } from 'node:crypto';

/** Stable hash of the text used for retrieval embeddings. */
export function hashEmbeddingContent(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export type ExistingEmbeddingFingerprint = {
  model: string;
  dimension: number;
  contentHash: string;
};

export type DesiredEmbeddingFingerprint = {
  model: string;
  dimension: number | null;
  contentHash: string;
};

/**
 * Skip re-embedding when content and model are unchanged.
 * If the desired dimension is unknown yet, match on model + content only.
 */
export function shouldSkipEmbedding(
  existing: ExistingEmbeddingFingerprint,
  desired: DesiredEmbeddingFingerprint,
): boolean {
  if (existing.model !== desired.model) {
    return false;
  }
  if (existing.contentHash !== desired.contentHash) {
    return false;
  }
  if (desired.dimension !== null && existing.dimension !== desired.dimension) {
    return false;
  }
  return true;
}

export function batchItems<T>(items: T[], batchSize: number): T[][] {
  if (batchSize < 1) {
    throw new Error(`batchSize must be >= 1, got ${batchSize}`);
  }

  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  return batches;
}

import type { SemanticSearchHit } from '../search';

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .split(/[^\p{L}\p{N}]+/u)
      .filter((token) => token.length > 2),
  );
}

/** Jaccard similarity over word tokens. */
export function textOverlapRatio(a: string, b: string): number {
  const left = tokenize(a);
  const right = tokenize(b);
  if (left.size === 0 || right.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const token of left) {
    if (right.has(token)) {
      intersection += 1;
    }
  }

  const union = left.size + right.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Keep higher-scoring hits; drop near-duplicates and low scores.
 * Input should already be sorted by score descending.
 */
export function filterAndDedupeHits(
  hits: SemanticSearchHit[],
  options: { minScore: number; dedupeOverlap: number; maxPassages: number },
): SemanticSearchHit[] {
  const kept: SemanticSearchHit[] = [];

  for (const hit of hits) {
    if (hit.score < options.minScore) {
      continue;
    }

    const duplicate = kept.some(
      (existing) =>
        textOverlapRatio(existing.normalizedText, hit.normalizedText) >=
        options.dedupeOverlap,
    );
    if (duplicate) {
      continue;
    }

    kept.push(hit);
    if (kept.length >= options.maxPassages) {
      break;
    }
  }

  return kept;
}

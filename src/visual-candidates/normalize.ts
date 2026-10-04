/**
 * Lightweight Portuguese-friendly normalization for heuristic matching.
 * No external NLP deps — lowercase, strip diacritics, collapse whitespace.
 */
export function normalizeForMatch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Whole-phrase match after normalization (space-bounded).
 * Avoids `desse acorde` matching trigger `esse acorde`.
 */
export function containsNormalizedPhrase(
  haystackNormalized: string,
  phraseNormalized: string,
): boolean {
  if (!haystackNormalized || !phraseNormalized) return false;
  return ` ${haystackNormalized} `.includes(` ${phraseNormalized} `);
}

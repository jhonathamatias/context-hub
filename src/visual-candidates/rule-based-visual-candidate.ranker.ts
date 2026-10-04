import type { TranscriptionSegment } from '../transcription/types';
import {
  containsNormalizedPhrase,
  normalizeForMatch,
} from './normalize';
import {
  CONTEXT_MUSICAL_BONUS,
  CONTEXT_MUSICAL_TERMS,
  CONTEXT_STRONG_BONUS,
  CONTEXT_STRONG_TERMS,
  MULTI_CATEGORY_BONUS,
  NEGATABLE_PHRASES,
  RELEVANCE_HIGH_MIN,
  RELEVANCE_MEDIUM_MIN,
  SCORED_PHRASES,
  type EvidenceCategory,
  type ScoredPhrase,
} from './scoring-weights';
import type {
  RankedVisualCandidate,
  VisualCandidate,
  VisualCandidateRanker,
  VisualRelevance,
} from './types';

const CONTEXT_PAD_SECONDS = 2;
const SNIPPET_MAX_CHARS = 220;

const PHRASE_BY_TRIGGER = new Map<string, ScoredPhrase>(
  SCORED_PHRASES.map((p) => [p.phrase, p]),
);

/**
 * Local, explainable ranker. Does not call LLMs or paid APIs.
 * Detector stays responsible for recall; this component ranks precision.
 */
export class RuleBasedVisualCandidateRanker implements VisualCandidateRanker {
  async rank(
    candidates: VisualCandidate[],
    segments: TranscriptionSegment[],
  ): Promise<RankedVisualCandidate[]> {
    const ranked = candidates.map((candidate) =>
      scoreCandidate(candidate, segments),
    );

    ranked.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.startSeconds !== b.startSeconds) {
        return a.startSeconds - b.startSeconds;
      }
      return a.endSeconds - b.endSeconds;
    });

    return ranked;
  }
}

function scoreCandidate(
  candidate: VisualCandidate,
  segments: TranscriptionSegment[],
): RankedVisualCandidate {
  const windowSegments = segmentsInWindow(
    segments,
    candidate.startSeconds - CONTEXT_PAD_SECONDS,
    candidate.endSeconds + CONTEXT_PAD_SECONDS,
  );
  const windowText = windowSegments.map((s) => s.text).join(' ');
  const windowNormalized = normalizeForMatch(windowText);
  const contextSnippet = buildSnippet(windowText);

  const uniqueTriggers = uniqueStrings(candidate.triggers);
  const scoreReasons: string[] = [];
  const rejectionReasons: string[] = [];
  const categories = new Set<EvidenceCategory>();
  let score = 0;
  let activeStrong = 0;
  let activeMedium = 0;
  let activeWeak = 0;
  let negatedWeakCount = 0;

  for (const trigger of uniqueTriggers) {
    const scored = PHRASE_BY_TRIGGER.get(trigger);
    if (!scored) {
      scoreReasons.push(`unknown trigger ignored: "${trigger}"`);
      continue;
    }

    if (
      scored.strength === 'weak' &&
      NEGATABLE_PHRASES.includes(scored.phrase) &&
      isPhraseNegatedInSegments(scored.phrase, windowSegments)
    ) {
      negatedWeakCount += 1;
      scoreReasons.push(
        `negated weak evidence: "${scored.phrase}" (no points)`,
      );
      continue;
    }

    score += scored.weight;
    categories.add(scored.category);
    if (scored.strength === 'strong') activeStrong += 1;
    else if (scored.strength === 'medium') activeMedium += 1;
    else activeWeak += 1;

    scoreReasons.push(
      `+${scored.weight} ${scored.strength} ${scored.label} ("${scored.phrase}")`,
    );
  }

  // Context bonuses: only when not already credited via a matching trigger phrase.
  const hasSpatialTrigger = [...categories].includes('spatial');
  const hasMusicalTrigger = [...categories].includes('musical_object');

  const strongContextHits = CONTEXT_STRONG_TERMS.filter((term) =>
    containsNormalizedPhrase(windowNormalized, term),
  );
  if (strongContextHits.length > 0 && !hasSpatialTrigger) {
    score += CONTEXT_STRONG_BONUS;
    categories.add('spatial');
    activeStrong += 1;
    scoreReasons.push(
      `+${CONTEXT_STRONG_BONUS} context spatial term(s): ${strongContextHits.join(', ')}`,
    );
  }

  const musicalContextHits = CONTEXT_MUSICAL_TERMS.filter((term) =>
    containsNormalizedPhrase(windowNormalized, term),
  );
  if (musicalContextHits.length > 0 && !hasMusicalTrigger) {
    score += CONTEXT_MUSICAL_BONUS;
    categories.add('musical_object');
    scoreReasons.push(
      `+${CONTEXT_MUSICAL_BONUS} context musical term(s): ${musicalContextHits
        .slice(0, 4)
        .join(', ')}`,
    );
  }

  if (categories.size >= 2) {
    score += MULTI_CATEGORY_BONUS;
    scoreReasons.push(
      `+${MULTI_CATEGORY_BONUS} multi-category bonus (${[...categories].join(' + ')})`,
    );
  }

  const hasSupportingContext =
    musicalContextHits.length > 0 ||
    strongContextHits.length > 0 ||
    activeMedium > 0 ||
    activeStrong > 0;

  let rejected = false;
  if (score <= 0) {
    rejected = true;
    rejectionReasons.push(
      negatedWeakCount > 0
        ? 'all weak evidence negated; no remaining score'
        : 'no scoring evidence remained',
    );
  } else if (
    activeStrong === 0 &&
    activeMedium === 0 &&
    activeWeak > 0 &&
    !hasSupportingContext
  ) {
    // Generic manner/play cues alone → reject (conservative alternative would be LOW)
    rejected = true;
    rejectionReasons.push(
      'only weak generic cue(s) without musical/spatial support',
    );
  }

  const relevance = resolveRelevance(score, rejected);

  return {
    ...candidate,
    score,
    relevance,
    scoreReasons,
    rejected,
    rejectionReasons,
    contextSnippet,
  };
}

function resolveRelevance(score: number, rejected: boolean): VisualRelevance {
  if (rejected) return 'low';
  if (score >= RELEVANCE_HIGH_MIN) return 'high';
  if (score >= RELEVANCE_MEDIUM_MIN) return 'medium';
  return 'low';
}

function segmentsInWindow(
  segments: TranscriptionSegment[],
  startSeconds: number,
  endSeconds: number,
): TranscriptionSegment[] {
  return segments.filter(
    (segment) =>
      segment.endSeconds >= startSeconds && segment.startSeconds <= endSeconds,
  );
}

/**
 * Conservative negation: "nao/nunca" within a few tokens before the weak phrase
 * inside the same segment (or adjacent joined text for that phrase).
 */
function isPhraseNegatedInSegments(
  phrase: string,
  segments: TranscriptionSegment[],
): boolean {
  for (const segment of segments) {
    const normalized = normalizeForMatch(segment.text);
    if (!containsNormalizedPhrase(normalized, phrase)) continue;
    if (hasNegationBeforePhrase(normalized, phrase)) return true;
  }

  // Also check a short join of adjacent matching segments.
  const joined = normalizeForMatch(segments.map((s) => s.text).join(' '));
  if (
    containsNormalizedPhrase(joined, phrase) &&
    hasNegationBeforePhrase(joined, phrase)
  ) {
    return true;
  }
  return false;
}

function hasNegationBeforePhrase(normalized: string, phrase: string): boolean {
  const padded = ` ${normalized} `;
  const needle = ` ${phrase} `;
  let fromIndex = 0;
  while (fromIndex < padded.length) {
    const at = padded.indexOf(needle, fromIndex);
    if (at < 0) break;
    const before = padded.slice(Math.max(0, at - 40), at);
    if (/(?:^|\s)(?:nao|nunca)(?:\s+\w+){0,5}\s*$/.test(before)) {
      return true;
    }
    fromIndex = at + needle.length;
  }
  return false;
}

function buildSnippet(text: string): string {
  const compact = text.replace(/\s+/g, ' ').trim();
  if (compact.length <= SNIPPET_MAX_CHARS) return compact;
  return `${compact.slice(0, SNIPPET_MAX_CHARS - 1)}…`;
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const key = value.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

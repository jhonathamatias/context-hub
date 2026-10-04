/**
 * Centralized, deterministic scoring weights for VisualCandidateRanker.
 * Easy to tweak without touching detector logic.
 */

export type EvidenceStrength = 'strong' | 'medium' | 'weak';
export type EvidenceCategory =
  | 'spatial'
  | 'attention'
  | 'demonstration'
  | 'musical_object';

export type ScoredPhrase = {
  phrase: string;
  weight: number;
  strength: EvidenceStrength;
  category: EvidenceCategory;
  label: string;
};

/** Trigger / cue phrases known from detection + ranking extras. */
export const SCORED_PHRASES: readonly ScoredPhrase[] = [
  // Strong spatial / shape / fingering (+3)
  {
    phrase: 'essa posicao da mao',
    weight: 3,
    strength: 'strong',
    category: 'spatial',
    label: 'hand position',
  },
  {
    phrase: 'essa digitacao',
    weight: 3,
    strength: 'strong',
    category: 'spatial',
    label: 'fingering',
  },
  {
    phrase: 'esse desenho',
    weight: 3,
    strength: 'strong',
    category: 'spatial',
    label: 'diagram/shape',
  },
  {
    phrase: 'nessa posicao',
    weight: 3,
    strength: 'strong',
    category: 'spatial',
    label: 'position',
  },
  {
    phrase: 'essa posicao',
    weight: 3,
    strength: 'strong',
    category: 'spatial',
    label: 'position',
  },
  {
    phrase: 'nessa regiao',
    weight: 3,
    strength: 'strong',
    category: 'spatial',
    label: 'fretboard region',
  },
  {
    phrase: 'essa regiao',
    weight: 3,
    strength: 'strong',
    category: 'spatial',
    label: 'fretboard region',
  },
  {
    phrase: 'nessa casa',
    weight: 3,
    strength: 'strong',
    category: 'spatial',
    label: 'fret position',
  },
  {
    phrase: 'essa casa',
    weight: 3,
    strength: 'strong',
    category: 'spatial',
    label: 'fret position',
  },
  {
    phrase: 'nesse formato',
    weight: 3,
    strength: 'strong',
    category: 'spatial',
    label: 'shape/form',
  },
  {
    phrase: 'esse formato',
    weight: 3,
    strength: 'strong',
    category: 'spatial',
    label: 'shape/form',
  },

  // Medium show cues / musical objects (+2)
  {
    phrase: 'deixa eu mostrar',
    weight: 2,
    strength: 'medium',
    category: 'demonstration',
    label: 'will show',
  },
  {
    phrase: 'vou mostrar',
    weight: 2,
    strength: 'medium',
    category: 'demonstration',
    label: 'will show',
  },
  {
    phrase: 'olha aqui',
    weight: 2,
    strength: 'medium',
    category: 'attention',
    label: 'look here',
  },
  {
    phrase: 'olha esse',
    weight: 2,
    strength: 'medium',
    category: 'attention',
    label: 'look at this',
  },
  {
    phrase: 'olha essa',
    weight: 2,
    strength: 'medium',
    category: 'attention',
    label: 'look at this',
  },
  {
    phrase: 'olha isso',
    weight: 2,
    strength: 'medium',
    category: 'attention',
    label: 'look at this',
  },
  {
    phrase: 'esse arpejo',
    weight: 2,
    strength: 'medium',
    category: 'musical_object',
    label: 'arpeggio object',
  },
  {
    phrase: 'nessa escala',
    weight: 2,
    strength: 'medium',
    category: 'musical_object',
    label: 'scale object',
  },
  {
    phrase: 'dessa escala',
    weight: 2,
    strength: 'medium',
    category: 'musical_object',
    label: 'scale object',
  },
  {
    phrase: 'essa escala',
    weight: 2,
    strength: 'medium',
    category: 'musical_object',
    label: 'scale object',
  },
  {
    phrase: 'nesse acorde',
    weight: 2,
    strength: 'medium',
    category: 'musical_object',
    label: 'chord object',
  },
  {
    phrase: 'desse acorde',
    weight: 2,
    strength: 'medium',
    category: 'musical_object',
    label: 'chord object',
  },
  {
    phrase: 'esse acorde',
    weight: 2,
    strength: 'medium',
    category: 'musical_object',
    label: 'chord object',
  },
  {
    phrase: 'esse lick',
    weight: 2,
    strength: 'medium',
    category: 'musical_object',
    label: 'lick object',
  },

  // Weak generic cues (+1)
  {
    phrase: 'olha so',
    weight: 1,
    strength: 'weak',
    category: 'attention',
    label: 'weak look cue',
  },
  {
    phrase: 'vou tocar',
    weight: 1,
    strength: 'weak',
    category: 'demonstration',
    label: 'weak play cue',
  },
  {
    phrase: 'vou fazer',
    weight: 1,
    strength: 'weak',
    category: 'demonstration',
    label: 'weak do cue',
  },
  {
    phrase: 'faz assim',
    weight: 1,
    strength: 'weak',
    category: 'demonstration',
    label: 'weak manner cue',
  },
  {
    phrase: 'faco assim',
    weight: 1,
    strength: 'weak',
    category: 'demonstration',
    label: 'weak manner cue',
  },
  {
    phrase: 'desse jeito',
    weight: 1,
    strength: 'weak',
    category: 'demonstration',
    label: 'weak manner cue',
  },
  {
    phrase: 'dessa forma',
    weight: 1,
    strength: 'weak',
    category: 'demonstration',
    label: 'weak manner cue',
  },
] as const;

/** Musical / spatial vocabulary scanned in local context (bonus evidence). */
export const CONTEXT_STRONG_TERMS: readonly string[] = [
  'shape',
  'digitacao',
  'braco',
  'desenho',
  'posicao',
  'pestana',
];

export const CONTEXT_MUSICAL_TERMS: readonly string[] = [
  'acorde',
  'escala',
  'arpejo',
  'lick',
  'frase',
  'casa',
  'corda',
  'dedo',
  'slide',
  'bend',
  'bending',
  'hammer',
  'pull',
  'palhetada',
  'penta',
];

/** Weak phrases that can be cancelled by nearby negation. */
export const NEGATABLE_PHRASES: readonly string[] = [
  'vou tocar',
  'vou fazer',
  'faz assim',
  'faco assim',
  'desse jeito',
  'dessa forma',
];

export const MULTI_CATEGORY_BONUS = 1;
export const CONTEXT_STRONG_BONUS = 1;
export const CONTEXT_MUSICAL_BONUS = 1;

/**
 * Relevance thresholds (documented for the POC):
 * - HIGH  (≥ 3): at least one strong spatial/shape cue, or equivalent combo
 * - MEDIUM (≥ 2): medium cue / musical object without strong spatial
 * - LOW   (≥ 1): only weak evidence that still has some support
 * - REJECTED: score 0, or only weak evidence with no musical/spatial support
 */
export const RELEVANCE_HIGH_MIN = 3;
export const RELEVANCE_MEDIUM_MIN = 2;

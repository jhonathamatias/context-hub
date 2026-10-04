/**
 * Local visual-demo cue phrases for guitar lessons (PT).
 * Keep phrases lowercase and without diacritics (matching uses normalizeForMatch).
 * Longer / more specific phrases first so reporting prefers them when sorting.
 */
export type VisualTrigger = {
  /** Normalized phrase to search inside segment text. */
  phrase: string;
  /** Short reason shown in POC output. */
  reason: string;
};

export const VISUAL_TRIGGERS: readonly VisualTrigger[] = [
  { phrase: 'essa posicao da mao', reason: 'hand position demonstration' },
  { phrase: 'essa digitacao', reason: 'fingering demonstration' },
  { phrase: 'esse desenho', reason: 'diagram / shape on fretboard' },
  { phrase: 'essa posicao', reason: 'position demonstration' },
  { phrase: 'nessa regiao', reason: 'fretboard region cue' },
  { phrase: 'nessa casa', reason: 'fret position cue' },
  { phrase: 'essa casa', reason: 'fret position cue' },
  { phrase: 'nesse formato', reason: 'shape / form demonstration' },
  { phrase: 'esse formato', reason: 'shape / form demonstration' },
  { phrase: 'esse arpejo', reason: 'arpeggio demonstration' },
  { phrase: 'nessa escala', reason: 'scale demonstration' },
  { phrase: 'dessa escala', reason: 'scale demonstration' },
  { phrase: 'essa escala', reason: 'scale demonstration' },
  { phrase: 'nesse acorde', reason: 'chord demonstration' },
  { phrase: 'desse acorde', reason: 'chord demonstration' },
  { phrase: 'esse acorde', reason: 'chord demonstration' },
  { phrase: 'esse lick', reason: 'lick demonstration' },
  { phrase: 'deixa eu mostrar', reason: 'teacher will show' },
  { phrase: 'vou mostrar', reason: 'teacher will show' },
  { phrase: 'olha esse', reason: 'look-at-this cue' },
  { phrase: 'olha essa', reason: 'look-at-this cue' },
  { phrase: 'olha isso', reason: 'look-at-this cue' },
  { phrase: 'olha aqui', reason: 'look-here cue' },
  { phrase: 'olha so', reason: 'look-at-this cue' },
  { phrase: 'desse jeito', reason: 'do-it-this-way cue' },
  { phrase: 'dessa forma', reason: 'do-it-this-way cue' },
  { phrase: 'faco assim', reason: 'I-do-it-like-this cue' },
  { phrase: 'faz assim', reason: 'do-it-like-this cue' },
  { phrase: 'vou tocar', reason: 'about to play demonstration' },
  { phrase: 'vou fazer', reason: 'about to demonstrate' },
] as const;

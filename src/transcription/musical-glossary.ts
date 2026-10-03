/**
 * Default musical vocabulary for Whisper initial_prompt.
 * Extend via WHISPER_GLOSSARY_EXTRA (append) or WHISPER_INITIAL_PROMPT (full override).
 * Never use blind string substitutions on transcript text.
 */
export const DEFAULT_MUSICAL_GLOSSARY = [
  'Glossário musical para aula de guitarra:',
  'dó ré mi fá sol lá si',
  'acorde tríade tétrade arpejo',
  'pentatônica escala maior escala menor campo harmônico',
  'intervalo inversão CAGED voicing',
  'outside inside target note drop 2',
  'dórico frígio mixolídio lídio lócrio',
  'improvisação fraseado',
].join(' ');

/**
 * Resolve Whisper initial_prompt from env-shaped inputs.
 * - initialPrompt "-" → disabled (undefined)
 * - initialPrompt set → full override
 * - else default glossary + optional extra append
 */
export function resolveWhisperInitialPrompt(input: {
  initialPrompt?: string | undefined;
  glossaryExtra?: string | undefined;
}): string | undefined {
  if (input.initialPrompt === '-') {
    return undefined;
  }
  if (input.initialPrompt !== undefined && input.initialPrompt.trim() !== '') {
    return input.initialPrompt;
  }

  const extra = input.glossaryExtra?.trim();
  if (extra) {
    return `${DEFAULT_MUSICAL_GLOSSARY} ${extra}`;
  }
  return DEFAULT_MUSICAL_GLOSSARY;
}

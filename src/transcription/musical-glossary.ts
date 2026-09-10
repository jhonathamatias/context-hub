/**
 * Default musical vocabulary for Whisper initial_prompt.
 * Extensible via WHISPER_INITIAL_PROMPT (full override) — never blind string replace.
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

export type {
  TranscriptionProvider,
  TranscriptionResult,
  TranscriptionSegment,
  TranscribeInput,
} from './types';
export {
  LocalWhisperTranscriptionProvider,
} from './local-whisper.provider';
export { normalizeSegments } from './normalize-segments';
export {
  groupTranscriptSegments,
  type GroupableSegment,
  type GroupTranscriptOptions,
  type TranscriptPresentationBlock,
} from './group-presentation-segments';
export { DEFAULT_MUSICAL_GLOSSARY } from './musical-glossary';
export {
  TRANSCRIPTION_PROVIDER,
  TranscriptionService,
  type TranscribeSourceResult,
} from './transcription.service';

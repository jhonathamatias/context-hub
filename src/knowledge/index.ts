export { buildTranscriptChunks, normalizeTranscriptText } from './chunking';
export type { ChunkingOptions, TranscriptChunkDraft } from './chunking';
export {
  structuredLessonKnowledgeSchema,
  type StructuredLessonKnowledge,
} from './knowledge.schema';
export { LlmKnowledgeExtractionProvider } from './llm-knowledge.provider';
export {
  KNOWLEDGE_EXTRACTION_PROVIDER,
  KnowledgeService,
  type ProcessKnowledgeResult,
} from './knowledge.service';
export type {
  KnowledgeExtractionInput,
  KnowledgeExtractionProvider,
} from './types';

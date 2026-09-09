export { buildTranscriptChunks, normalizeTranscriptText } from './chunking';
export type { ChunkingOptions, TranscriptChunkDraft } from './chunking';
export {
  structuredLessonKnowledgeSchema,
  type StructuredLessonKnowledge,
} from './knowledge.schema';
export { OpenAiKnowledgeExtractionProvider } from './openai-knowledge.provider';
export { GeminiKnowledgeExtractionProvider } from './gemini-knowledge.provider';
export {
  KNOWLEDGE_EXTRACTION_PROVIDER,
  KnowledgeService,
  type ProcessKnowledgeResult,
} from './knowledge.service';
export type {
  KnowledgeExtractionInput,
  KnowledgeExtractionProvider,
} from './types';

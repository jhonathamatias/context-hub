import type { TranscriptionSegment } from '../transcription/types';
import type { StructuredLessonKnowledge } from './knowledge.schema';
import type { TranscriptChunkDraft } from './chunking';

export type KnowledgeExtractionInput = {
  sourceId: string;
  language: string | null;
  fullText: string;
  segments: TranscriptionSegment[];
  chunks: TranscriptChunkDraft[];
};

export interface KnowledgeExtractionProvider {
  readonly name: string;
  extract(
    input: KnowledgeExtractionInput,
  ): Promise<StructuredLessonKnowledge>;
}

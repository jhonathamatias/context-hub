import { Token } from 'typedi';
import type { StructuredLessonKnowledge } from '../knowledge/knowledge.schema';

export type VideoAnalysisInput = {
  sourceId: string;
  /** Absolute path to the original lesson video on disk. */
  videoPath: string;
  originalName: string;
  mimeType: string;
};

/**
 * Domain contract for multimodal lesson analysis (audio + visual).
 * Implementations must return StructuredLessonKnowledge — never vendor DTOs.
 */
export interface VideoKnowledgeProvider {
  readonly name: string;
  analyze(input: VideoAnalysisInput): Promise<StructuredLessonKnowledge>;
}

export const VIDEO_KNOWLEDGE_PROVIDER = new Token<VideoKnowledgeProvider>(
  'VideoKnowledgeProvider',
);

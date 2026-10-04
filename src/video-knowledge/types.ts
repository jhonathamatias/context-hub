import { Token } from 'typedi';
import type { StructuredLessonKnowledge } from '../knowledge/knowledge.schema';

/** Neutral telemetry from a video knowledge adapter (no vendor SDK types). */
export type VideoAnalysisTelemetry = {
  provider: string;
  model: string;
  sourceId: string;
  processingMode: string;
  mediaResolution: string;
  durationMs: number;
  fileReuse: boolean;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

export type VideoAnalysisInput = {
  sourceId: string;
  /** Absolute path to the original lesson video on disk. */
  videoPath: string;
  originalName: string;
  mimeType: string;
  /** Optional model override (used after primary attempts for fallback). */
  model?: string;
  /** Optional POC metrics hook — adapters call without vendor payloads. */
  onTelemetry?: (event: VideoAnalysisTelemetry) => void;
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

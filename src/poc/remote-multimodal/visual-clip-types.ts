export type VisualFindingClassification =
  | 'NEW_VISUAL_INFORMATION'
  | 'SUPPORTED_BY_TRANSCRIPT'
  | 'DUPLICATE_OF_TRANSCRIPT'
  | 'UNCERTAIN';

export type VisualFinding = {
  type: string;
  description: string;
  startSeconds?: number | null;
  endSeconds?: number | null;
  absoluteStartSeconds?: number | null;
  absoluteEndSeconds?: number | null;
  confidence?: number | null;
  classification?: VisualFindingClassification;
};

export type VisualClipKnowledge = {
  clipStartSeconds: number;
  clipEndSeconds: number;
  summary: string;
  visualFindings: VisualFinding[];
  losesImportantInfoWithoutVideo: boolean | null;
  losesImportantInfoReason: string | null;
};

export type VisualClipAnalysisResult = {
  knowledge: VisualClipKnowledge;
  telemetry: {
    provider: string;
    model: string;
    processingMode: string;
    mediaResolution: string;
    durationMs: number;
    fileReuse: boolean;
    inputTokens: number | null;
    outputTokens: number | null;
    totalTokens: number | null;
  };
};

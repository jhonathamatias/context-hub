export type SourceStatus = 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';

export type SourceSummary = {
  id: string;
  type: string;
  originalName: string;
  status: SourceStatus;
  createdAt: string;
  updatedAt: string;
};

export type SourceListResult = {
  items: SourceSummary[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type SourceStatusResult = {
  id: string;
  originalName: string;
  status: SourceStatus;
  createdAt: string;
  updatedAt: string;
  pipeline: {
    transcription: {
      status: string | null;
      language: string | null;
      attempt: number | null;
      updatedAt: string | null;
    };
    knowledge: {
      status: string | null;
      suggestedTitle: string | null;
      updatedAt: string | null;
    };
    chunks: { count: number };
    embeddings: { count: number };
    latestJobs: Array<{
      id: string;
      stage: string;
      status: string;
      errorMessage: string | null;
      startedAt: string | null;
      finishedAt: string | null;
    }>;
  };
};

export type SourceTranscriptResult = {
  sourceId: string;
  transcriptionId: string;
  status: string;
  language: string | null;
  fullText: string | null;
  segments: Array<{
    startSeconds: number;
    endSeconds: number;
    text: string;
  }>;
};

export type SourceKnowledgeResult = {
  sourceId: string;
  knowledgeExtractionId: string;
  status: string;
  suggestedTitle: string | null;
  summary: string | null;
  knowledge: Record<string, unknown> | null;
};

export type ChatReference = {
  index: number;
  sourceId: string;
  sourceName: string;
  chunkId: string;
  startSeconds: number;
  endSeconds: number;
  score: number;
  excerpt: string;
};

export type ChatResponse = {
  question: string;
  answer: string;
  sufficientEvidence: boolean;
  references: ChatReference[];
  mode: string;
};

export type ApiErrorBody = {
  statusCode?: number;
  error?: string;
  message?: string;
  requestId?: string;
};

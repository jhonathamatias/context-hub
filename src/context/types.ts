import type { SemanticSearchHit } from '../search';

export type ContextCitation = {
  index: number;
  sourceId: string;
  sourceName: string;
  chunkId: string;
  startSeconds: number;
  endSeconds: number;
  score: number;
  excerpt: string;
};

export type AssembledContext = {
  passages: ContextCitation[];
  promptBlock: string;
  totalChars: number;
  sufficientEvidence: boolean;
};

export type AnswerGenerationInput = {
  question: string;
  mode: 'course';
  context: AssembledContext;
};

export type GeneratedAnswer = {
  answer: string;
  citationIndexes: number[];
  sufficientEvidence: boolean;
};

export interface AnswerGenerationProvider {
  readonly name: string;
  generate(input: AnswerGenerationInput): Promise<GeneratedAnswer>;
}

export type AskRequest = {
  question: string;
  sourceId?: string;
  limit?: number;
  mode?: 'course';
};

export type AskResponse = {
  question: string;
  mode: 'course';
  answer: string;
  sufficientEvidence: boolean;
  citations: ContextCitation[];
  retrieval: {
    hitCount: number;
    usedCount: number;
    provider: string;
    model: string;
  };
};

export type RetrievalOptions = {
  /** Fetch this many vector hits before dedupe/filter. */
  fetchLimit: number;
  /** Keep at most this many passages for the LLM. */
  maxPassages: number;
  /** Soft cap on characters in the assembled prompt block. */
  maxChars: number;
  /** Drop hits below this similarity score. */
  minScore: number;
  /** Jaccard token overlap above this → treat as duplicate. */
  dedupeOverlap: number;
};

export const DEFAULT_RETRIEVAL_OPTIONS: RetrievalOptions = {
  fetchLimit: 16,
  maxPassages: 6,
  maxChars: 7000,
  minScore: 0.28,
  dedupeOverlap: 0.82,
};

export type RetrievedHit = SemanticSearchHit;

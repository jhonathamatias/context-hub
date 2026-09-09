import { Token } from 'typedi';

/** Differentiates call sites without coupling them to a vendor SDK. */
export type LlmUseCase =
  | 'knowledge_extraction'
  | 'answer_generation'
  | 'classification';

export type LlmChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type LlmGenerateJsonInput = {
  useCase: LlmUseCase;
  messages: LlmChatMessage[];
  temperature?: number;
  maxOutputTokens?: number;
};

export type LlmUsageMetrics = {
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  /** Best-effort USD estimate; null when pricing is unknown. */
  estimatedCostUsd: number | null;
};

export type LlmGenerateJsonResult = {
  content: string;
  model: string;
  provider: string;
  useCase: LlmUseCase;
  usage: LlmUsageMetrics;
  latencyMs: number;
  attempts: number;
};

export interface LlmProvider {
  readonly name: string;
  readonly model: string;
  generateJson(input: LlmGenerateJsonInput): Promise<LlmGenerateJsonResult>;
}

export const LLM_PROVIDER = new Token<LlmProvider>('LlmProvider');

import type { LlmUsageMetrics } from './types';

/** Rough public list prices (USD / 1M tokens). Best-effort only. */
const OPENAI_COST_PER_MILLION: Record<
  string,
  { input: number; output: number }
> = {
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4o': { input: 2.5, output: 10 },
};

export function emptyUsage(): LlmUsageMetrics {
  return {
    promptTokens: null,
    completionTokens: null,
    totalTokens: null,
    estimatedCostUsd: null,
  };
}

export function buildUsageMetrics(input: {
  provider: string;
  model: string;
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
}): LlmUsageMetrics {
  const promptTokens = input.promptTokens ?? null;
  const completionTokens = input.completionTokens ?? null;
  const totalTokens =
    input.totalTokens ??
    (promptTokens !== null && completionTokens !== null
      ? promptTokens + completionTokens
      : null);

  let estimatedCostUsd: number | null = null;
  if (
    input.provider === 'openai' &&
    promptTokens !== null &&
    completionTokens !== null
  ) {
    const pricing =
      OPENAI_COST_PER_MILLION[input.model] ??
      OPENAI_COST_PER_MILLION['gpt-4o-mini'];
    if (pricing) {
      estimatedCostUsd =
        (promptTokens / 1_000_000) * pricing.input +
        (completionTokens / 1_000_000) * pricing.output;
    }
  }

  return {
    promptTokens,
    completionTokens,
    totalTokens,
    estimatedCostUsd,
  };
}

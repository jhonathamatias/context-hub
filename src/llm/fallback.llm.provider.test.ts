import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { FallbackLlmProvider } from './fallback.llm.provider';
import type { LlmProvider } from './types';

function mockProvider(
  name: string,
  impl: LlmProvider['generateJson'],
): LlmProvider {
  return {
    name,
    model: `${name}-model`,
    generateJson: impl,
  };
}

const okResult = {
  content: '{"ok":true}',
  model: 'm',
  provider: 'primary',
  useCase: 'knowledge_extraction' as const,
  usage: {
    promptTokens: null,
    completionTokens: null,
    totalTokens: null,
    estimatedCostUsd: null,
  },
  latencyMs: 1,
  attempts: 1,
};

describe('FallbackLlmProvider', () => {
  it('returns primary success without calling fallback', async () => {
    let fallbackCalls = 0;
    const primary = mockProvider('gemini', async () => ({
      ...okResult,
      provider: 'gemini',
      model: 'gemini-model',
    }));
    const fallback = mockProvider('ollama', async () => {
      fallbackCalls += 1;
      return { ...okResult, provider: 'ollama', model: 'ollama-model' };
    });

    const provider = new FallbackLlmProvider(primary, fallback);
    const result = await provider.generateJson({
      useCase: 'knowledge_extraction',
      messages: [{ role: 'user', content: 'x' }],
    });

    assert.equal(result.provider, 'gemini');
    assert.equal(fallbackCalls, 0);
  });

  it('falls back on 429', async () => {
    const primary = mockProvider('gemini', async () => {
      throw Object.assign(new Error('quota exceeded'), { status: 429 });
    });
    const fallback = mockProvider('ollama', async () => ({
      ...okResult,
      provider: 'ollama',
      model: 'local',
    }));

    const provider = new FallbackLlmProvider(primary, fallback);
    const result = await provider.generateJson({
      useCase: 'knowledge_extraction',
      messages: [{ role: 'user', content: 'x' }],
    });

    assert.equal(result.provider, 'ollama');
  });

  it('does not fall back on 400 / client errors', async () => {
    let fallbackCalls = 0;
    const primary = mockProvider('gemini', async () => {
      throw Object.assign(new Error('bad request'), { status: 400 });
    });
    const fallback = mockProvider('ollama', async () => {
      fallbackCalls += 1;
      return { ...okResult, provider: 'ollama' };
    });

    const provider = new FallbackLlmProvider(primary, fallback);
    await assert.rejects(
      () =>
        provider.generateJson({
          useCase: 'knowledge_extraction',
          messages: [{ role: 'user', content: 'x' }],
        }),
      (error: unknown) =>
        typeof error === 'object' &&
        error !== null &&
        (error as { status?: number }).status === 400,
    );
    assert.equal(fallbackCalls, 0);
  });

  it('tries each provider at most once (no infinite loop)', async () => {
    let primaryCalls = 0;
    let fallbackCalls = 0;
    const primary = mockProvider('gemini', async () => {
      primaryCalls += 1;
      throw Object.assign(new Error('rate limit'), { status: 429 });
    });
    const fallback = mockProvider('ollama', async () => {
      fallbackCalls += 1;
      throw Object.assign(new Error('unavailable'), { status: 503 });
    });

    const provider = new FallbackLlmProvider(primary, fallback);
    await assert.rejects(
      () =>
        provider.generateJson({
          useCase: 'knowledge_extraction',
          messages: [{ role: 'user', content: 'x' }],
        }),
      (error: unknown) =>
        error instanceof Error &&
        error.message.includes('Fallback (ollama) failed') &&
        error.message.includes('unavailable'),
    );
    assert.equal(primaryCalls, 1);
    assert.equal(fallbackCalls, 1);
  });
});

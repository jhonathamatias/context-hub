import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { OllamaLlmProvider } from './ollama.llm.provider';

describe('OllamaLlmProvider', () => {
  it('posts to /api/chat with format json and returns content', async () => {
    const calls: Array<{ url: string; body: unknown }> = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input, init) => {
      const url = String(input);
      const body = JSON.parse(String(init?.body ?? '{}'));
      calls.push({ url, body });
      return new Response(
        JSON.stringify({ message: { content: '{"ok":true}' } }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }) as typeof fetch;

    try {
      const provider = new OllamaLlmProvider({
        baseUrl: 'http://ollama.test:11434',
        model: 'test-model:7b',
        timeoutMs: 5_000,
        maxRetries: 0,
        maxOutputTokens: 1024,
      });

      const result = await provider.generateJson({
        useCase: 'knowledge_extraction',
        messages: [
          { role: 'system', content: 'sys' },
          { role: 'user', content: 'user' },
        ],
      });

      assert.equal(provider.name, 'ollama');
      assert.equal(provider.model, 'test-model:7b');
      assert.equal(result.content, '{"ok":true}');
      assert.equal(result.provider, 'ollama');
      assert.equal(calls.length, 1);
      assert.equal(calls[0]!.url, 'http://ollama.test:11434/api/chat');
      assert.equal((calls[0]!.body as { model: string }).model, 'test-model:7b');
      assert.equal((calls[0]!.body as { format: string }).format, 'json');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('surfaces 429 as retryable status', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response('rate limit', {
        status: 429,
        headers: { 'retry-after': '1' },
      })) as typeof fetch;

    try {
      const provider = new OllamaLlmProvider({
        baseUrl: 'http://ollama.test:11434',
        model: 'm',
        timeoutMs: 5_000,
        maxRetries: 0,
        maxOutputTokens: 128,
      });

      await assert.rejects(
        () =>
          provider.generateJson({
            useCase: 'answer_generation',
            messages: [{ role: 'user', content: 'x' }],
          }),
        (error: unknown) =>
          typeof error === 'object' &&
          error !== null &&
          (error as { status?: number }).status === 429,
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

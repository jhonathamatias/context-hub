import { withControlledRetries } from './retry';
import type {
  LlmGenerateJsonInput,
  LlmGenerateJsonResult,
  LlmProvider,
} from './types';
import { emptyUsage } from './usage';

export type OllamaLlmProviderOptions = {
  baseUrl: string;
  model: string;
  timeoutMs: number;
  maxRetries: number;
  maxOutputTokens: number;
};

type OllamaChatResponse = {
  message?: { content?: string };
  error?: string;
};

/**
 * Local LLM via Ollama HTTP API (/api/chat with format: json).
 * Implements the same LlmProvider contract as Gemini/OpenAI.
 * Config is injected (no hardcoded model/url).
 */
export class OllamaLlmProvider implements LlmProvider {
  readonly name = 'ollama';

  constructor(private readonly options: OllamaLlmProviderOptions) {}

  get model(): string {
    return this.options.model;
  }

  private get baseUrl(): string {
    return this.options.baseUrl.replace(/\/$/, '');
  }

  async generateJson(
    input: LlmGenerateJsonInput,
  ): Promise<LlmGenerateJsonResult> {
    const startedAt = Date.now();
    const model = this.model;
    const { value, attempts } = await withControlledRetries(
      async () => {
        const controller = new AbortController();
        const timer = setTimeout(
          () => controller.abort(),
          this.options.timeoutMs,
        );
        try {
          const response = await fetch(`${this.baseUrl}/api/chat`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              model,
              stream: false,
              format: 'json',
              options: {
                temperature: input.temperature ?? 0.2,
                num_predict:
                  input.maxOutputTokens ?? this.options.maxOutputTokens,
              },
              messages: input.messages.map((message) => ({
                role: message.role,
                content: message.content,
              })),
            }),
          });

          if (!response.ok) {
            const body = await response.text().catch(() => '');
            const error = new Error(
              `Ollama request failed (${response.status}): ${body.slice(0, 200)}`,
            ) as Error & { status?: number; headers?: Headers };
            error.status = response.status;
            error.headers = response.headers;
            throw error;
          }

          const payload = (await response.json()) as OllamaChatResponse;
          if (payload.error) {
            throw new Error(`Ollama error: ${payload.error}`);
          }

          const content = payload.message?.content?.trim();
          if (!content) {
            throw new Error('Ollama returned an empty JSON response');
          }

          return content;
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            const timeoutError = new Error(
              `LLM request timed out after ${this.options.timeoutMs}ms`,
            ) as Error & { code?: string };
            timeoutError.code = 'ETIMEDOUT';
            throw timeoutError;
          }
          throw error;
        } finally {
          clearTimeout(timer);
        }
      },
      { maxRetries: this.options.maxRetries, baseDelayMs: 1_000 },
    );

    return {
      content: value,
      model,
      provider: this.name,
      useCase: input.useCase,
      usage: emptyUsage(),
      latencyMs: Date.now() - startedAt,
      attempts,
    };
  }
}

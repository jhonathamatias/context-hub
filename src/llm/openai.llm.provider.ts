import OpenAI from 'openai';
import { Service } from 'typedi';
import { env } from '../config/env';
import { withControlledRetries } from './retry';
import type {
  LlmGenerateJsonInput,
  LlmGenerateJsonResult,
  LlmProvider,
} from './types';
import { buildUsageMetrics, emptyUsage } from './usage';

@Service()
export class OpenAiLlmProvider implements LlmProvider {
  readonly name = 'openai';

  get model(): string {
    return env.openai.model ?? 'gpt-4o-mini';
  }

  async generateJson(
    input: LlmGenerateJsonInput,
  ): Promise<LlmGenerateJsonResult> {
    if (!env.openai.apiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const client = new OpenAI({
      apiKey: env.openai.apiKey,
      ...(env.openai.baseUrl ? { baseURL: env.openai.baseUrl } : {}),
      timeout: env.llm.timeoutMs,
      maxRetries: 0,
    });

    const startedAt = Date.now();
    const { value, attempts } = await withControlledRetries(
      async () => {
        const response = await client.chat.completions.create({
          model: this.model,
          temperature: input.temperature ?? 0.2,
          max_tokens: input.maxOutputTokens ?? env.llm.maxOutputTokens,
          response_format: { type: 'json_object' },
          messages: input.messages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error('OpenAI returned an empty JSON response');
        }

        return {
          content,
          usage: buildUsageMetrics({
            provider: this.name,
            model: this.model,
            promptTokens: response.usage?.prompt_tokens ?? null,
            completionTokens: response.usage?.completion_tokens ?? null,
            totalTokens: response.usage?.total_tokens ?? null,
          }),
        };
      },
      { maxRetries: env.llm.maxRetries, baseDelayMs: 1_000 },
    );

    return {
      content: value.content,
      model: this.model,
      provider: this.name,
      useCase: input.useCase,
      usage: value.usage ?? emptyUsage(),
      latencyMs: Date.now() - startedAt,
      attempts,
    };
  }
}

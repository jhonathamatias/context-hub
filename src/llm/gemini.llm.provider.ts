import { GoogleGenerativeAI } from '@google/generative-ai';
import { Service } from 'typedi';
import { env } from '../config/env';
import { withControlledRetries } from './retry';
import type {
  LlmGenerateJsonInput,
  LlmGenerateJsonResult,
  LlmProvider,
} from './types';
import { emptyUsage } from './usage';

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      const error = new Error(`LLM request timed out after ${timeoutMs}ms`);
      (error as Error & { code?: string }).code = 'ETIMEDOUT';
      reject(error);
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error: unknown) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

@Service()
export class GeminiLlmProvider implements LlmProvider {
  readonly name = 'gemini';

  get model(): string {
    return env.gemini.model;
  }

  async generateJson(
    input: LlmGenerateJsonInput,
  ): Promise<LlmGenerateJsonResult> {
    if (!env.gemini.apiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    const client = new GoogleGenerativeAI(env.gemini.apiKey);
    const model = client.getGenerativeModel({
      model: this.model,
      generationConfig: {
        temperature: input.temperature ?? 0.2,
        maxOutputTokens: input.maxOutputTokens ?? env.llm.maxOutputTokens,
        responseMimeType: 'application/json',
      },
    });

    const startedAt = Date.now();
    const { value, attempts } = await withControlledRetries(
      async () => {
        const result = await withTimeout(
          model.generateContent(
            input.messages.map((message) => ({ text: message.content })),
          ),
          env.llm.timeoutMs,
        );
        const content = result.response.text();
        if (!content) {
          throw new Error('Gemini returned an empty JSON response');
        }
        return content;
      },
      { maxRetries: env.llm.maxRetries, baseDelayMs: 1_000 },
    );

    return {
      content: value,
      model: this.model,
      provider: this.name,
      useCase: input.useCase,
      usage: emptyUsage(),
      latencyMs: Date.now() - startedAt,
      attempts,
    };
  }
}

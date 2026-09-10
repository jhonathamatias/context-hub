import type {
  LlmGenerateJsonInput,
  LlmGenerateJsonResult,
  LlmProvider,
} from './types';
import { isFallbackEligibleError } from './retry';

export type FallbackLlmLogger = {
  info: (obj: Record<string, unknown>, msg?: string) => void;
  warn: (obj: Record<string, unknown>, msg?: string) => void;
};

/**
 * Tries primary once (provider may still retry internally), then fallback once
 * only for recoverable provider failures. Never loops across providers.
 */
export class FallbackLlmProvider implements LlmProvider {
  readonly name: string;

  constructor(
    private readonly primary: LlmProvider,
    private readonly fallback: LlmProvider,
    private readonly logger?: FallbackLlmLogger,
  ) {
    this.name = `${primary.name}+fallback:${fallback.name}`;
  }

  get model(): string {
    return this.primary.model;
  }

  async generateJson(
    input: LlmGenerateJsonInput,
  ): Promise<LlmGenerateJsonResult> {
    const startedAt = Date.now();
    this.logger?.info(
      {
        operation: 'llm.generateJson',
        useCase: input.useCase,
        provider: this.primary.name,
        model: this.primary.model,
        fallbackUsed: false,
        attempt: 1,
      },
      'LLM primary attempt',
    );

    try {
      const result = await this.primary.generateJson(input);
      this.logger?.info(
        {
          operation: 'llm.generateJson',
          useCase: input.useCase,
          provider: result.provider,
          model: result.model,
          fallbackUsed: false,
          attempt: result.attempts,
          durationMs: Date.now() - startedAt,
        },
        'LLM primary succeeded',
      );
      return result;
    } catch (error) {
      if (!isFallbackEligibleError(error)) {
        throw error;
      }

      const reason = error instanceof Error ? error.message : String(error);
      this.logger?.warn(
        {
          operation: 'llm.generateJson',
          useCase: input.useCase,
          provider: this.primary.name,
          model: this.primary.model,
          fallbackProvider: this.fallback.name,
          fallbackModel: this.fallback.model,
          fallbackUsed: true,
          reason: reason.slice(0, 240),
          durationMs: Date.now() - startedAt,
        },
        'LLM primary failed; trying fallback',
      );

      const fallbackStarted = Date.now();
      try {
        const result = await this.fallback.generateJson(input);
        this.logger?.info(
          {
            operation: 'llm.generateJson',
            useCase: input.useCase,
            provider: result.provider,
            model: result.model,
            fallbackUsed: true,
            primaryProvider: this.primary.name,
            attempt: result.attempts,
            durationMs: Date.now() - fallbackStarted,
          },
          'LLM fallback succeeded',
        );
        return {
          ...result,
          latencyMs: Date.now() - startedAt,
        };
      } catch (fallbackError) {
        this.logger?.warn(
          {
            operation: 'llm.generateJson',
            useCase: input.useCase,
            provider: this.fallback.name,
            model: this.fallback.model,
            fallbackUsed: true,
            primaryProvider: this.primary.name,
            reason:
              fallbackError instanceof Error
                ? fallbackError.message.slice(0, 240)
                : String(fallbackError).slice(0, 240),
            durationMs: Date.now() - startedAt,
          },
          'LLM fallback failed',
        );
        const primaryReason = reason.slice(0, 180);
        const fallbackReason =
          fallbackError instanceof Error
            ? fallbackError.message.slice(0, 180)
            : String(fallbackError).slice(0, 180);
        throw new Error(
          `LLM primary (${this.primary.name}) failed: ${primaryReason}. Fallback (${this.fallback.name}) failed: ${fallbackReason}`,
        );
      }
    }
  }
}

import type { FastifyBaseLogger } from 'fastify';
import { Container } from 'typedi';
import { env } from '../config/env';
import {
  ANSWER_GENERATION_PROVIDER,
  LlmAnswerGenerationProvider,
} from '../context';
import {
  EMBEDDING_PROVIDER,
  GeminiEmbeddingProvider,
  OpenAiEmbeddingProvider,
} from '../embeddings';
import {
  KNOWLEDGE_EXTRACTION_PROVIDER,
  LlmKnowledgeExtractionProvider,
} from '../knowledge';
import {
  FallbackLlmProvider,
  GeminiLlmProvider,
  LLM_PROVIDER,
  OllamaLlmProvider,
  OpenAiLlmProvider,
  type LlmProvider,
} from '../llm';
import { PgVectorRepository, VECTOR_REPOSITORY } from '../search';
import {
  LocalWhisperTranscriptionProvider,
  TRANSCRIPTION_PROVIDER,
} from '../transcription';

function resolveLlmProvider(
  name: 'openai' | 'gemini' | 'ollama',
): LlmProvider {
  switch (name) {
    case 'gemini':
      return Container.get(GeminiLlmProvider);
    case 'ollama':
      return new OllamaLlmProvider({
        baseUrl: env.ollama.baseUrl,
        model: env.ollama.model,
        timeoutMs: env.llm.timeoutMs,
        maxRetries: env.llm.maxRetries,
        maxOutputTokens: env.llm.maxOutputTokens,
      });
    default:
      return Container.get(OpenAiLlmProvider);
  }
}

/** Shared Typedi bindings for API and worker processes. */
export function registerDomainProviders(logger?: FastifyBaseLogger): void {
  Container.set(
    TRANSCRIPTION_PROVIDER,
    Container.get(LocalWhisperTranscriptionProvider),
  );

  const primary = resolveLlmProvider(env.llm.provider);
  const fallbackName = env.llm.fallbackProvider;
  const llm: LlmProvider =
    fallbackName && fallbackName !== env.llm.provider
      ? new FallbackLlmProvider(
          primary,
          resolveLlmProvider(fallbackName),
          logger
            ? {
                info: (obj, msg) => logger.info(obj, msg),
                warn: (obj, msg) => logger.warn(obj, msg),
              }
            : undefined,
        )
      : primary;

  Container.set(LLM_PROVIDER, llm);
  Container.set(
    KNOWLEDGE_EXTRACTION_PROVIDER,
    Container.get(LlmKnowledgeExtractionProvider),
  );
  Container.set(
    EMBEDDING_PROVIDER,
    env.embedding.provider === 'gemini'
      ? Container.get(GeminiEmbeddingProvider)
      : Container.get(OpenAiEmbeddingProvider),
  );
  Container.set(VECTOR_REPOSITORY, Container.get(PgVectorRepository));
  Container.set(
    ANSWER_GENERATION_PROVIDER,
    Container.get(LlmAnswerGenerationProvider),
  );

  logger?.info(
    {
      llmProvider: env.llm.provider,
      llmFallbackProvider: env.llm.fallbackProvider ?? null,
      llmModel: primary.model,
      llmTimeoutMs: env.llm.timeoutMs,
      llmMaxRetries: env.llm.maxRetries,
      llmConcurrency: env.llm.concurrency,
    },
    'LLM provider selected',
  );
  logger?.info(
    {
      embeddingProvider: env.embedding.provider,
      embeddingModel:
        env.embedding.provider === 'gemini'
          ? env.embedding.geminiModel
          : env.embedding.openaiModel,
    },
    'Embedding provider selected',
  );
  logger?.info(
    {
      whisperModel: env.whisper.model,
      whisperDevice: env.whisper.device,
      whisperLanguage: env.whisper.language ?? null,
      whisperInitialPromptEnabled: Boolean(env.whisper.initialPrompt),
    },
    'Whisper transcription config',
  );
}

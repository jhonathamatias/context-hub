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
  GeminiLlmProvider,
  LLM_PROVIDER,
  OpenAiLlmProvider,
} from '../llm';
import { PgVectorRepository, VECTOR_REPOSITORY } from '../search';
import {
  LocalWhisperTranscriptionProvider,
  TRANSCRIPTION_PROVIDER,
} from '../transcription';

/** Shared Typedi bindings for API and worker processes. */
export function registerDomainProviders(logger?: FastifyBaseLogger): void {
  Container.set(
    TRANSCRIPTION_PROVIDER,
    Container.get(LocalWhisperTranscriptionProvider),
  );
  Container.set(
    LLM_PROVIDER,
    env.llm.provider === 'gemini'
      ? Container.get(GeminiLlmProvider)
      : Container.get(OpenAiLlmProvider),
  );
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
      llmTimeoutMs: env.llm.timeoutMs,
      llmMaxRetries: env.llm.maxRetries,
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
}

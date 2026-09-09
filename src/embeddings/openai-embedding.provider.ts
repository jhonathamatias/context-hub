import OpenAI from 'openai';
import { Service } from 'typedi';
import { env } from '../config/env';
import type { EmbedBatchResult, EmbeddingProvider } from './types';

@Service()
export class OpenAiEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'openai';

  get model(): string {
    return env.embedding.openaiModel;
  }

  get dimension(): number | null {
    return env.embedding.dimension ?? null;
  }

  async embed(texts: string[]): Promise<EmbedBatchResult> {
    if (texts.length === 0) {
      return {
        vectors: [],
        model: this.model,
        dimension: this.dimension ?? 0,
      };
    }

    if (!env.openai.apiKey) {
      throw new Error('OPENAI_API_KEY is not configured for embeddings');
    }

    const client = new OpenAI({
      apiKey: env.openai.apiKey,
      ...(env.openai.baseUrl ? { baseURL: env.openai.baseUrl } : {}),
    });

    const response = await client.embeddings.create({
      model: this.model,
      input: texts,
      ...(this.dimension !== null ? { dimensions: this.dimension } : {}),
    });

    const ordered = [...response.data].sort((a, b) => a.index - b.index);
    const vectors = ordered.map((item) => item.embedding);

    if (vectors.length !== texts.length) {
      throw new Error(
        `OpenAI returned ${vectors.length} embeddings for ${texts.length} texts`,
      );
    }

    const dimension = vectors[0]?.length;
    if (!dimension) {
      throw new Error('OpenAI returned an empty embedding vector');
    }

    return {
      vectors,
      model: this.model,
      dimension,
    };
  }
}

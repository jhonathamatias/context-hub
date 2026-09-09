import { GoogleGenerativeAI } from '@google/generative-ai';
import { Service } from 'typedi';
import { env } from '../config/env';
import type { EmbedBatchResult, EmbeddingProvider } from './types';

@Service()
export class GeminiEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'gemini';

  get model(): string {
    return env.embedding.geminiModel;
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

    if (!env.gemini.apiKey) {
      throw new Error('GEMINI_API_KEY is not configured for embeddings');
    }

    const client = new GoogleGenerativeAI(env.gemini.apiKey);
    const model = client.getGenerativeModel({ model: this.model });

    const response = await model.batchEmbedContents({
      requests: texts.map((text) => ({
        content: { role: 'user', parts: [{ text }] },
        ...(this.dimension !== null
          ? { outputDimensionality: this.dimension }
          : {}),
      })),
    });

    const vectors = response.embeddings.map((item) => item.values);

    if (vectors.length !== texts.length) {
      throw new Error(
        `Gemini returned ${vectors.length} embeddings for ${texts.length} texts`,
      );
    }

    const dimension = vectors[0]?.length;
    if (!dimension) {
      throw new Error('Gemini returned an empty embedding vector');
    }

    return {
      vectors,
      model: this.model,
      dimension,
    };
  }
}

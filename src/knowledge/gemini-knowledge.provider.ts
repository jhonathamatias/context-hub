import { GoogleGenerativeAI } from '@google/generative-ai';
import { Service } from 'typedi';
import { env } from '../config/env';
import {
  structuredLessonKnowledgeSchema,
  type StructuredLessonKnowledge,
} from './knowledge.schema';
import { buildKnowledgeExtractionPrompt } from './prompt';
import type {
  KnowledgeExtractionInput,
  KnowledgeExtractionProvider,
} from './types';

@Service()
export class GeminiKnowledgeExtractionProvider
  implements KnowledgeExtractionProvider
{
  readonly name = 'gemini';

  async extract(
    input: KnowledgeExtractionInput,
  ): Promise<StructuredLessonKnowledge> {
    if (!env.gemini.apiKey) {
      throw new Error(
        'GEMINI_API_KEY is not configured. Chunks were still saved.',
      );
    }

    const client = new GoogleGenerativeAI(env.gemini.apiKey);
    const model = client.getGenerativeModel({
      model: env.gemini.model,
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
      },
    });

    const prompt = buildKnowledgeExtractionPrompt(input);
    const result = await model.generateContent([
      { text: prompt.system },
      { text: prompt.user },
    ]);

    const content = result.response.text();
    if (!content) {
      throw new Error('Gemini returned an empty knowledge extraction response');
    }

    const parsed = structuredLessonKnowledgeSchema.safeParse(
      JSON.parse(content),
    );
    if (!parsed.success) {
      throw new Error(
        `Gemini knowledge payload failed schema validation: ${parsed.error.message}`,
      );
    }

    return parsed.data;
  }
}

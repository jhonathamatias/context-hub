import OpenAI from 'openai';
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
export class OpenAiKnowledgeExtractionProvider
  implements KnowledgeExtractionProvider
{
  readonly name = 'openai';

  async extract(
    input: KnowledgeExtractionInput,
  ): Promise<StructuredLessonKnowledge> {
    if (!env.openai.apiKey) {
      throw new Error(
        'OPENAI_API_KEY is not configured. Chunks were still saved.',
      );
    }

    const client = new OpenAI({
      apiKey: env.openai.apiKey,
      ...(env.openai.baseUrl ? { baseURL: env.openai.baseUrl } : {}),
    });

    const model = env.openai.model ?? 'gpt-4o-mini';
    const prompt = buildKnowledgeExtractionPrompt(input);

    const response = await client.chat.completions.create({
      model,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('OpenAI returned an empty knowledge extraction response');
    }

    const parsed = structuredLessonKnowledgeSchema.safeParse(
      JSON.parse(content),
    );
    if (!parsed.success) {
      throw new Error(
        `OpenAI knowledge payload failed schema validation: ${parsed.error.message}`,
      );
    }

    return parsed.data;
  }
}

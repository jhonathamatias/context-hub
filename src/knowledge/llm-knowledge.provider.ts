import { Inject, Service } from 'typedi';
import { LLM_PROVIDER, type LlmProvider } from '../llm/types';
import {
  structuredLessonKnowledgeSchema,
  type StructuredLessonKnowledge,
} from './knowledge.schema';
import { buildKnowledgeExtractionPrompt } from './prompt';
import type {
  KnowledgeExtractionInput,
  KnowledgeExtractionProvider,
} from './types';

/**
 * Use-case adapter: knowledge extraction talks to LlmProvider only (no vendor SDK).
 */
@Service()
export class LlmKnowledgeExtractionProvider
  implements KnowledgeExtractionProvider
{
  constructor(
    @Inject(LLM_PROVIDER)
    private readonly llm: LlmProvider,
  ) {}

  get name(): string {
    return this.llm.name;
  }

  async extract(
    input: KnowledgeExtractionInput,
  ): Promise<StructuredLessonKnowledge> {
    const prompt = buildKnowledgeExtractionPrompt(input);
    const result = await this.llm.generateJson({
      useCase: 'knowledge_extraction',
      temperature: 0.2,
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
    });

    const parsed = structuredLessonKnowledgeSchema.safeParse(
      JSON.parse(result.content),
    );
    if (!parsed.success) {
      throw new Error(
        `Knowledge payload failed schema validation: ${parsed.error.message}`,
      );
    }

    return parsed.data;
  }
}

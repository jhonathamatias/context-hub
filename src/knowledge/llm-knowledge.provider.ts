import { Inject, Service } from 'typedi';
import { parseLlmJsonObject } from '../llm/parse-llm-json';
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
      // Long lessons need headroom; 4096 often truncates mid-JSON.
      maxOutputTokens: 8192,
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
    });

    let payload: unknown;
    try {
      payload = parseLlmJsonObject(result.content);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `${message}. Response length=${result.content.length}. Often caused by maxOutputTokens truncation.`,
      );
    }

    const parsed = structuredLessonKnowledgeSchema.safeParse(payload);
    if (!parsed.success) {
      throw new Error(
        `Knowledge payload failed schema validation: ${parsed.error.message}`,
      );
    }

    return parsed.data;
  }
}

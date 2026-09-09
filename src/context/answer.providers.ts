import { Inject, Service, Token } from 'typedi';
import { LLM_PROVIDER, type LlmProvider } from '../llm/types';
import { buildCourseAnswerPrompt, generatedAnswerSchema } from './prompt';
import type {
  AnswerGenerationInput,
  AnswerGenerationProvider,
  GeneratedAnswer,
} from './types';

export const ANSWER_GENERATION_PROVIDER = new Token<AnswerGenerationProvider>(
  'AnswerGenerationProvider',
);

function insufficientAnswer(): GeneratedAnswer {
  return {
    answer:
      'Não encontrei evidência suficiente nas aulas indexadas para responder com segurança a essa pergunta.',
    citationIndexes: [],
    sufficientEvidence: false,
  };
}

/**
 * Use-case adapter: answer generation talks to LlmProvider only (no vendor SDK).
 */
@Service()
export class LlmAnswerGenerationProvider implements AnswerGenerationProvider {
  constructor(
    @Inject(LLM_PROVIDER)
    private readonly llm: LlmProvider,
  ) {}

  get name(): string {
    return this.llm.name;
  }

  async generate(input: AnswerGenerationInput): Promise<GeneratedAnswer> {
    if (!input.context.sufficientEvidence || input.context.passages.length === 0) {
      return insufficientAnswer();
    }

    const prompt = buildCourseAnswerPrompt({
      question: input.question,
      promptBlock: input.context.promptBlock,
    });

    const result = await this.llm.generateJson({
      useCase: 'answer_generation',
      temperature: 0.2,
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
    });

    const parsed = generatedAnswerSchema.safeParse(JSON.parse(result.content));
    if (!parsed.success) {
      throw new Error(
        `Answer payload failed schema validation: ${parsed.error.message}`,
      );
    }

    const allowed = new Set(input.context.passages.map((passage) => passage.index));
    return {
      answer: parsed.data.answer,
      citationIndexes: parsed.data.citationIndexes.filter((index) =>
        allowed.has(index),
      ),
      sufficientEvidence: parsed.data.sufficientEvidence,
    };
  }
}

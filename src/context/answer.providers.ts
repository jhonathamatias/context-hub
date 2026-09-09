import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { Service, Token } from 'typedi';
import { env } from '../config/env';
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

function parseGeneratedAnswer(
  content: string,
  allowedIndexes: Set<number>,
): GeneratedAnswer {
  const parsed = generatedAnswerSchema.safeParse(JSON.parse(content));
  if (!parsed.success) {
    throw new Error(
      `Answer payload failed schema validation: ${parsed.error.message}`,
    );
  }

  return {
    answer: parsed.data.answer,
    citationIndexes: parsed.data.citationIndexes.filter((index) =>
      allowedIndexes.has(index),
    ),
    sufficientEvidence: parsed.data.sufficientEvidence,
  };
}

@Service()
export class GeminiAnswerGenerationProvider
  implements AnswerGenerationProvider
{
  readonly name = 'gemini';

  async generate(input: AnswerGenerationInput): Promise<GeneratedAnswer> {
    if (!env.gemini.apiKey) {
      throw new Error('GEMINI_API_KEY is not configured for answers');
    }

    if (!input.context.sufficientEvidence || input.context.passages.length === 0) {
      return insufficientAnswer();
    }

    const client = new GoogleGenerativeAI(env.gemini.apiKey);
    const model = client.getGenerativeModel({
      model: env.gemini.model,
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
      },
    });

    const prompt = buildCourseAnswerPrompt({
      question: input.question,
      promptBlock: input.context.promptBlock,
    });

    const result = await model.generateContent([
      { text: prompt.system },
      { text: prompt.user },
    ]);

    const content = result.response.text();
    if (!content) {
      throw new Error('Gemini returned an empty answer');
    }

    return parseGeneratedAnswer(
      content,
      new Set(input.context.passages.map((passage) => passage.index)),
    );
  }
}

@Service()
export class OpenAiAnswerGenerationProvider
  implements AnswerGenerationProvider
{
  readonly name = 'openai';

  async generate(input: AnswerGenerationInput): Promise<GeneratedAnswer> {
    if (!env.openai.apiKey) {
      throw new Error('OPENAI_API_KEY is not configured for answers');
    }

    if (!input.context.sufficientEvidence || input.context.passages.length === 0) {
      return insufficientAnswer();
    }

    const client = new OpenAI({
      apiKey: env.openai.apiKey,
      ...(env.openai.baseUrl ? { baseURL: env.openai.baseUrl } : {}),
    });

    const prompt = buildCourseAnswerPrompt({
      question: input.question,
      promptBlock: input.context.promptBlock,
    });

    const response = await client.chat.completions.create({
      model: env.openai.model ?? 'gpt-4o-mini',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('OpenAI returned an empty answer');
    }

    return parseGeneratedAnswer(
      content,
      new Set(input.context.passages.map((passage) => passage.index)),
    );
  }
}

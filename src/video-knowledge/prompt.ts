import { SchemaType, type ResponseSchema } from '@google/generative-ai';

/**
 * Short, deterministic multimodal prompt. No huge examples.
 * Schema is enforced via structured output separately.
 */
export function buildMultimodalVideoKnowledgePrompt(): string {
  return [
    'You analyze a guitar/music lesson video (audio + visuals).',
    'Return ONLY JSON matching the schema.',
    'Identify: suggestedTitle, summary, topics, concepts, techniques,',
    'theoryHarmony, scalesArpeggiosChords, exercises, licksOrPracticalIdeas,',
    'teacherRecommendations, reviewQuestions.',
    'Use startSeconds/endSeconds when you can locate moments; otherwise null.',
    'Never invent timestamps you cannot justify from the video.',
    'Be concise. Prefer Portuguese when the lesson is in Portuguese.',
  ].join(' ');
}

const nullableNumber: ResponseSchema = {
  type: SchemaType.NUMBER,
  nullable: true,
};

const timedItem: ResponseSchema = {
  type: SchemaType.OBJECT,
  required: ['name'],
  properties: {
    name: { type: SchemaType.STRING },
    description: { type: SchemaType.STRING, nullable: true },
    startSeconds: nullableNumber,
    endSeconds: nullableNumber,
  },
};

const timedItemWithKind: ResponseSchema = {
  type: SchemaType.OBJECT,
  required: ['name'],
  properties: {
    name: { type: SchemaType.STRING },
    description: { type: SchemaType.STRING, nullable: true },
    kind: {
      type: SchemaType.STRING,
      format: 'enum',
      enum: ['scale', 'arpeggio', 'chord', 'other'],
      nullable: true,
    },
    startSeconds: nullableNumber,
    endSeconds: nullableNumber,
  },
};

const timedDescription: ResponseSchema = {
  type: SchemaType.OBJECT,
  required: ['description'],
  properties: {
    description: { type: SchemaType.STRING },
    startSeconds: nullableNumber,
    endSeconds: nullableNumber,
  },
};

const timedText: ResponseSchema = {
  type: SchemaType.OBJECT,
  required: ['text'],
  properties: {
    text: { type: SchemaType.STRING },
    startSeconds: nullableNumber,
    endSeconds: nullableNumber,
  },
};

const reviewQuestion: ResponseSchema = {
  type: SchemaType.OBJECT,
  required: ['question'],
  properties: {
    question: { type: SchemaType.STRING },
    startSeconds: nullableNumber,
    endSeconds: nullableNumber,
  },
};

/**
 * Gemini OpenAPI subset — no additionalProperties, no type unions.
 * Nullable fields use `nullable: true` instead of `type: ['number','null']`.
 */
export const multimodalKnowledgeResponseSchema: ResponseSchema = {
  type: SchemaType.OBJECT,
  required: [
    'suggestedTitle',
    'summary',
    'topics',
    'concepts',
    'techniques',
    'theoryHarmony',
    'scalesArpeggiosChords',
    'exercises',
    'licksOrPracticalIdeas',
    'teacherRecommendations',
    'reviewQuestions',
  ],
  properties: {
    suggestedTitle: { type: SchemaType.STRING },
    summary: { type: SchemaType.STRING },
    topics: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
    },
    concepts: { type: SchemaType.ARRAY, items: timedItem },
    techniques: { type: SchemaType.ARRAY, items: timedItem },
    theoryHarmony: { type: SchemaType.ARRAY, items: timedItem },
    scalesArpeggiosChords: {
      type: SchemaType.ARRAY,
      items: timedItemWithKind,
    },
    exercises: { type: SchemaType.ARRAY, items: timedDescription },
    licksOrPracticalIdeas: {
      type: SchemaType.ARRAY,
      items: timedDescription,
    },
    teacherRecommendations: {
      type: SchemaType.ARRAY,
      items: timedText,
    },
    reviewQuestions: {
      type: SchemaType.ARRAY,
      items: reviewQuestion,
    },
  },
};

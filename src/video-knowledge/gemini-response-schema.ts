import { Type, type Schema } from '@google/genai';

/**
 * Gemini-only response schema (@google/genai Type enum).
 * Kept inside the adapter surface — not part of domain contracts.
 */
const nullableNumber: Schema = {
  type: Type.NUMBER,
  nullable: true,
};

const timedItem: Schema = {
  type: Type.OBJECT,
  required: ['name'],
  properties: {
    name: { type: Type.STRING },
    description: { type: Type.STRING, nullable: true },
    startSeconds: nullableNumber,
    endSeconds: nullableNumber,
  },
};

const timedItemWithKind: Schema = {
  type: Type.OBJECT,
  required: ['name'],
  properties: {
    name: { type: Type.STRING },
    description: { type: Type.STRING, nullable: true },
    kind: {
      type: Type.STRING,
      format: 'enum',
      enum: ['scale', 'arpeggio', 'chord', 'other'],
      nullable: true,
    },
    startSeconds: nullableNumber,
    endSeconds: nullableNumber,
  },
};

const timedDescription: Schema = {
  type: Type.OBJECT,
  required: ['description'],
  properties: {
    description: { type: Type.STRING },
    startSeconds: nullableNumber,
    endSeconds: nullableNumber,
  },
};

const timedText: Schema = {
  type: Type.OBJECT,
  required: ['text'],
  properties: {
    text: { type: Type.STRING },
    startSeconds: nullableNumber,
    endSeconds: nullableNumber,
  },
};

const reviewQuestion: Schema = {
  type: Type.OBJECT,
  required: ['question'],
  properties: {
    question: { type: Type.STRING },
    startSeconds: nullableNumber,
    endSeconds: nullableNumber,
  },
};

export const multimodalKnowledgeResponseSchema: Schema = {
  type: Type.OBJECT,
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
    suggestedTitle: { type: Type.STRING },
    summary: { type: Type.STRING },
    topics: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    concepts: { type: Type.ARRAY, items: timedItem },
    techniques: { type: Type.ARRAY, items: timedItem },
    theoryHarmony: { type: Type.ARRAY, items: timedItem },
    scalesArpeggiosChords: {
      type: Type.ARRAY,
      items: timedItemWithKind,
    },
    exercises: { type: Type.ARRAY, items: timedDescription },
    licksOrPracticalIdeas: {
      type: Type.ARRAY,
      items: timedDescription,
    },
    teacherRecommendations: {
      type: Type.ARRAY,
      items: timedText,
    },
    reviewQuestions: {
      type: Type.ARRAY,
      items: reviewQuestion,
    },
  },
};

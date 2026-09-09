import { z } from 'zod';

const timedItemSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  startSeconds: z.number().nonnegative().nullable().optional(),
  endSeconds: z.number().nonnegative().nullable().optional(),
});

const timedTextSchema = z.object({
  text: z.string().min(1),
  startSeconds: z.number().nonnegative().nullable().optional(),
  endSeconds: z.number().nonnegative().nullable().optional(),
});

const timedDescriptionSchema = z.object({
  description: z.string().min(1),
  startSeconds: z.number().nonnegative().nullable().optional(),
  endSeconds: z.number().nonnegative().nullable().optional(),
});

const reviewQuestionSchema = z.object({
  question: z.string().min(1),
  startSeconds: z.number().nonnegative().nullable().optional(),
  endSeconds: z.number().nonnegative().nullable().optional(),
});

export const structuredLessonKnowledgeSchema = z.object({
  suggestedTitle: z.string().min(1),
  summary: z.string().min(1),
  topics: z.array(z.string().min(1)).default([]),
  concepts: z.array(timedItemSchema).default([]),
  techniques: z.array(timedItemSchema).default([]),
  theoryHarmony: z.array(timedItemSchema).default([]),
  scalesArpeggiosChords: z
    .array(
      timedItemSchema.extend({
        kind: z.enum(['scale', 'arpeggio', 'chord', 'other']).optional(),
      }),
    )
    .default([]),
  exercises: z.array(timedDescriptionSchema).default([]),
  licksOrPracticalIdeas: z.array(timedDescriptionSchema).default([]),
  teacherRecommendations: z.array(timedTextSchema).default([]),
  reviewQuestions: z.array(reviewQuestionSchema).default([]),
});

export type StructuredLessonKnowledge = z.infer<
  typeof structuredLessonKnowledgeSchema
>;

export const structuredLessonKnowledgeJsonSchema = {
  type: 'object',
  additionalProperties: false,
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
    suggestedTitle: { type: 'string' },
    summary: { type: 'string' },
    topics: { type: 'array', items: { type: 'string' } },
    concepts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name'],
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          startSeconds: { type: ['number', 'null'] },
          endSeconds: { type: ['number', 'null'] },
        },
      },
    },
    techniques: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name'],
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          startSeconds: { type: ['number', 'null'] },
          endSeconds: { type: ['number', 'null'] },
        },
      },
    },
    theoryHarmony: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name'],
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          startSeconds: { type: ['number', 'null'] },
          endSeconds: { type: ['number', 'null'] },
        },
      },
    },
    scalesArpeggiosChords: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name'],
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          kind: {
            type: 'string',
            enum: ['scale', 'arpeggio', 'chord', 'other'],
          },
          startSeconds: { type: ['number', 'null'] },
          endSeconds: { type: ['number', 'null'] },
        },
      },
    },
    exercises: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['description'],
        properties: {
          description: { type: 'string' },
          startSeconds: { type: ['number', 'null'] },
          endSeconds: { type: ['number', 'null'] },
        },
      },
    },
    licksOrPracticalIdeas: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['description'],
        properties: {
          description: { type: 'string' },
          startSeconds: { type: ['number', 'null'] },
          endSeconds: { type: ['number', 'null'] },
        },
      },
    },
    teacherRecommendations: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['text'],
        properties: {
          text: { type: 'string' },
          startSeconds: { type: ['number', 'null'] },
          endSeconds: { type: ['number', 'null'] },
        },
      },
    },
    reviewQuestions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['question'],
        properties: {
          question: { type: 'string' },
          startSeconds: { type: ['number', 'null'] },
          endSeconds: { type: ['number', 'null'] },
        },
      },
    },
  },
} as const;

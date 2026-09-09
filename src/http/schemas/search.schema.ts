import { z } from 'zod';

export const searchBodySchema = z.object({
  query: z.string().trim().min(1, 'query must not be empty'),
  sourceId: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export type SearchBody = z.infer<typeof searchBodySchema>;

export const askBodySchema = z.object({
  question: z.string().trim().min(1, 'question must not be empty'),
  sourceId: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(20).optional(),
  mode: z.literal('course').optional(),
});

export type AskBody = z.infer<typeof askBodySchema>;

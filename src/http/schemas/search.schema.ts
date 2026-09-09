import { z } from 'zod';

export const searchBodySchema = z.object({
  query: z.string().trim().min(1, 'query must not be empty'),
  sourceId: z.uuid().optional(),
  sourceIds: z.array(z.uuid()).max(20).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export type SearchBody = z.infer<typeof searchBodySchema>;

const chatHistoryMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().trim().min(1).max(2000),
});

export const askBodySchema = z.object({
  question: z.string().trim().min(1, 'question must not be empty'),
  sourceId: z.uuid().optional(),
  sourceIds: z.array(z.uuid()).max(20).optional(),
  limit: z.coerce.number().int().min(1).max(20).optional(),
  mode: z.literal('course').optional(),
  history: z.array(chatHistoryMessageSchema).max(6).optional(),
});

export type AskBody = z.infer<typeof askBodySchema>;

/** Chat is the product-facing alias of ask, with the same payload. */
export const chatBodySchema = askBodySchema;
export type ChatBody = AskBody;

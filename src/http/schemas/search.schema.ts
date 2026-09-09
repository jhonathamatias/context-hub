import { z } from 'zod';

export const searchBodySchema = z.object({
  query: z.string().trim().min(1, 'query must not be empty'),
  sourceId: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export type SearchBody = z.infer<typeof searchBodySchema>;

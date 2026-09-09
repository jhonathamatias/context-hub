import { z } from 'zod';

export const sourceIdParamsSchema = z.object({
  sourceId: z.uuid(),
});

export type SourceIdParams = z.infer<typeof sourceIdParamsSchema>;

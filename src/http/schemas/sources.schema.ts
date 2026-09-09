import { z } from 'zod';

export const sourceIdParamsSchema = z.object({
  sourceId: z.uuid(),
});

export type SourceIdParams = z.infer<typeof sourceIdParamsSchema>;

export const ingestFilesystemBodySchema = z.object({
  path: z.string().trim().min(1, 'path must not be empty'),
});

export type IngestFilesystemBody = z.infer<typeof ingestFilesystemBodySchema>;

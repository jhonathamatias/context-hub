import { z } from 'zod';
import { SourceStatus } from '../../database/enums';

export const sourceIdParamsSchema = z.object({
  sourceId: z.uuid(),
});

export type SourceIdParams = z.infer<typeof sourceIdParamsSchema>;

export const ingestFilesystemBodySchema = z.object({
  path: z.string().trim().min(1, 'path must not be empty'),
});

export type IngestFilesystemBody = z.infer<typeof ingestFilesystemBodySchema>;

export const listSourcesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.nativeEnum(SourceStatus).optional(),
});

export type ListSourcesQuery = z.infer<typeof listSourcesQuerySchema>;

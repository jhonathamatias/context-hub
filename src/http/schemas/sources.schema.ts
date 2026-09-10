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

export const ingestOneDriveBodySchema = z
  .object({
    url: z.string().trim().url('url must be a valid OneDrive / SharePoint link').optional(),
    integrationId: z.uuid().optional(),
    itemId: z.string().trim().min(1).optional(),
    importAll: z.boolean().optional(),
    /** Optional lesson/file name for a single-item import. */
    originalName: z.string().trim().min(1).max(512).optional(),
  })
  .refine((body) => Boolean(body.url || body.integrationId), {
    message: 'url or integrationId is required',
  });

export type IngestOneDriveBody = z.infer<typeof ingestOneDriveBodySchema>;

export const previewOneDriveBodySchema = z
  .object({
    url: z.string().trim().url('url must be a valid OneDrive / SharePoint link').optional(),
    integrationId: z.uuid().optional(),
  })
  .refine((body) => Boolean(body.url || body.integrationId), {
    message: 'url or integrationId is required',
  });

export type PreviewOneDriveBody = z.infer<typeof previewOneDriveBodySchema>;

export const oneDriveStreamQuerySchema = z
  .object({
    url: z.string().trim().url('url must be a valid OneDrive / SharePoint link').optional(),
    integrationId: z.uuid().optional(),
    itemId: z.string().trim().min(1, 'itemId is required'),
  })
  .refine((body) => Boolean(body.url || body.integrationId), {
    message: 'url or integrationId is required',
  });

export type OneDriveStreamQuery = z.infer<typeof oneDriveStreamQuerySchema>;

export const listSourcesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.nativeEnum(SourceStatus).optional(),
});

export type ListSourcesQuery = z.infer<typeof listSourcesQuerySchema>;

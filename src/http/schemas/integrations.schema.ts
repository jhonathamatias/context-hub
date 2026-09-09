import { z } from 'zod';
import { IntegrationKind } from '../../database/enums';

export const integrationIdParamsSchema = z.object({
  integrationId: z.uuid(),
});

export type IntegrationIdParams = z.infer<typeof integrationIdParamsSchema>;

export const listIntegrationsQuerySchema = z.object({
  kind: z.nativeEnum(IntegrationKind).optional(),
});

export type ListIntegrationsQuery = z.infer<typeof listIntegrationsQuerySchema>;

export const createIntegrationBodySchema = z.object({
  kind: z.nativeEnum(IntegrationKind).default(IntegrationKind.ONEDRIVE),
  name: z.string().trim().min(1).max(256),
  accessToken: z.string().trim().min(1).optional(),
  shareUrl: z.string().trim().url().optional(),
});

export type CreateIntegrationBody = z.infer<typeof createIntegrationBodySchema>;

export const updateIntegrationBodySchema = z
  .object({
    name: z.string().trim().min(1).max(256).optional(),
    accessToken: z.string().trim().min(1).nullable().optional(),
    shareUrl: z.string().trim().url().nullable().optional(),
    clearAccessToken: z.boolean().optional(),
  })
  .refine(
    (body) =>
      body.name !== undefined ||
      body.accessToken !== undefined ||
      body.shareUrl !== undefined ||
      body.clearAccessToken !== undefined,
    { message: 'At least one field must be provided' },
  );

export type UpdateIntegrationBody = z.infer<typeof updateIntegrationBodySchema>;

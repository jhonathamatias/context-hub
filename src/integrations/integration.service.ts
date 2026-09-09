import { Service } from 'typedi';
import {
  DatabaseService,
  Integration,
  IntegrationKind,
  type IntegrationMetadata,
} from '../database';
import { VideoValidationError } from '../video/file-validation';

export type PublicIntegration = {
  id: string;
  kind: IntegrationKind;
  name: string;
  hasAccessToken: boolean;
  shareUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateIntegrationInput = {
  kind: IntegrationKind;
  name: string;
  accessToken?: string | null;
  shareUrl?: string | null;
};

export type UpdateIntegrationInput = {
  name?: string;
  accessToken?: string | null;
  shareUrl?: string | null;
  clearAccessToken?: boolean;
};

@Service()
export class IntegrationService {
  constructor(private readonly database: DatabaseService) {}

  async list(kind?: IntegrationKind): Promise<PublicIntegration[]> {
    const repo = this.database.getRepository(Integration);
    const rows = await repo.find({
      ...(kind ? { where: { kind } } : {}),
      order: { createdAt: 'DESC' },
    });
    return rows.map(toPublic);
  }

  async getById(id: string): Promise<Integration> {
    const row = await this.database.getRepository(Integration).findOne({
      where: { id },
    });
    if (!row) {
      const error = new Error(`Integration not found: ${id}`);
      (error as Error & { statusCode?: number }).statusCode = 404;
      throw error;
    }
    return row;
  }

  async getPublicById(id: string): Promise<PublicIntegration> {
    return toPublic(await this.getById(id));
  }

  async create(input: CreateIntegrationInput): Promise<PublicIntegration> {
    const name = input.name.trim();
    if (!name) {
      throw new VideoValidationError('Integration name is required');
    }

    const repo = this.database.getRepository(Integration);
    const row = repo.create({
      kind: input.kind,
      name,
      accessToken: normalizeToken(input.accessToken),
      metadata: metadataFromShareUrl(input.shareUrl),
    });
    const saved = await repo.save(row);
    return toPublic(saved);
  }

  async update(
    id: string,
    input: UpdateIntegrationInput,
  ): Promise<PublicIntegration> {
    const row = await this.getById(id);

    if (input.name !== undefined) {
      const name = input.name.trim();
      if (!name) {
        throw new VideoValidationError('Integration name is required');
      }
      row.name = name;
    }

    if (input.clearAccessToken) {
      row.accessToken = null;
    } else if (input.accessToken !== undefined) {
      row.accessToken = normalizeToken(input.accessToken);
    }

    if (input.shareUrl !== undefined) {
      row.metadata = metadataFromShareUrl(input.shareUrl);
    }

    const saved = await this.database.getRepository(Integration).save(row);
    return toPublic(saved);
  }

  async remove(id: string): Promise<void> {
    const result = await this.database.getRepository(Integration).delete({ id });
    if (!result.affected) {
      const error = new Error(`Integration not found: ${id}`);
      (error as Error & { statusCode?: number }).statusCode = 404;
      throw error;
    }
  }

  /** Resolve Graph token: saved integration → env fallback. */
  async resolveOneDriveAccessToken(
    integrationId?: string,
  ): Promise<string | undefined> {
    if (!integrationId) {
      return undefined;
    }
    const row = await this.getById(integrationId);
    if (row.kind !== IntegrationKind.ONEDRIVE) {
      throw new VideoValidationError('Integration is not OneDrive');
    }
    return row.accessToken?.trim() || undefined;
  }

  async resolveOneDriveShareUrl(
    integrationId: string | undefined,
    fallbackUrl?: string,
  ): Promise<string> {
    if (fallbackUrl?.trim()) {
      return fallbackUrl.trim();
    }
    if (!integrationId) {
      throw new VideoValidationError('url or integrationId is required');
    }
    const row = await this.getById(integrationId);
    const shareUrl = row.metadata?.shareUrl?.trim();
    if (!shareUrl) {
      throw new VideoValidationError(
        'This integration has no default share URL. Pass url in the request.',
      );
    }
    return shareUrl;
  }
}

function normalizeToken(token: string | null | undefined): string | null {
  const value = token?.trim();
  return value ? value : null;
}

function metadataFromShareUrl(
  shareUrl: string | null | undefined,
): IntegrationMetadata | null {
  const value = shareUrl?.trim();
  return value ? { shareUrl: value } : null;
}

function toPublic(row: Integration): PublicIntegration {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    hasAccessToken: Boolean(row.accessToken?.trim()),
    shareUrl: row.metadata?.shareUrl ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

import { access, stat } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { Service } from 'typedi';
import { SourceType } from '../database/enums';
import {
  VideoValidationError,
  normalizeExtension,
} from '../video/file-validation';
import type {
  CollectedSourceItem,
  CollectContext,
  SourceConnector,
  SourceConnectorIdentity,
} from './types';

const ALLOWED_EXTENSIONS = ['mp4', 'mov', 'webm', 'mkv'];

export type LocalFilesystemInput = {
  path: string;
};

@Service()
export class LocalFilesystemVideoConnector
  implements SourceConnector<LocalFilesystemInput>
{
  readonly identity: SourceConnectorIdentity = {
    kind: 'local-filesystem',
    label: 'Local filesystem video',
  };

  supports(input: unknown): boolean {
    if (!input || typeof input !== 'object') {
      return false;
    }
    const candidate = input as Partial<LocalFilesystemInput>;
    return typeof candidate.path === 'string' && candidate.path.trim().length > 0;
  }

  async collect(
    input: LocalFilesystemInput,
    _context: CollectContext,
  ): Promise<CollectedSourceItem[]> {
    const contentPath = resolve(input.path.trim());
    const extension = normalizeExtension(contentPath);

    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      throw new VideoValidationError(
        `Unsupported video format ".${extension}". Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`,
      );
    }

    try {
      await access(contentPath);
    } catch {
      const error = new Error(`File not found: ${contentPath}`);
      (error as Error & { statusCode?: number }).statusCode = 404;
      throw error;
    }

    const info = await stat(contentPath);
    if (!info.isFile()) {
      throw new VideoValidationError(`Path is not a file: ${contentPath}`);
    }

    return [
      {
        connectorKind: this.identity.kind,
        sourceType: SourceType.VIDEO,
        originalName: basename(contentPath),
        contentPath,
        contentType: `video/${extension}`,
        ephemeral: false,
        checkpoint: contentPath,
        version: `${info.mtimeMs}:${info.size}`,
        metadata: {
          extension,
          sizeBytes: info.size,
          mtimeMs: info.mtimeMs,
          origin: 'local-filesystem',
        },
      },
    ];
  }
}

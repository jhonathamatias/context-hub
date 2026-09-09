import { createWriteStream } from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { Readable } from 'node:stream';
import { Service } from 'typedi';
import { env } from '../config/env';
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

export type LocalUploadInput = {
  filename: string;
  mimetype: string;
  fileStream: Readable;
};

@Service()
export class LocalUploadVideoConnector
  implements SourceConnector<LocalUploadInput>
{
  readonly identity: SourceConnectorIdentity = {
    kind: 'local-upload',
    label: 'Local video upload',
  };

  supports(input: unknown): boolean {
    if (!input || typeof input !== 'object') {
      return false;
    }
    const candidate = input as Partial<LocalUploadInput>;
    return (
      typeof candidate.filename === 'string' &&
      typeof candidate.mimetype === 'string' &&
      candidate.fileStream !== undefined
    );
  }

  async collect(
    input: LocalUploadInput,
    _context: CollectContext,
  ): Promise<CollectedSourceItem[]> {
    const extension = normalizeExtension(input.filename);
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      throw new VideoValidationError(
        `Unsupported video format ".${extension}". Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`,
      );
    }

    const workDir = await mkdtemp(join(env.tempDir, 'upload-'));
    const contentPath = join(workDir, `upload.${extension}`);
    await pipeline(input.fileStream, createWriteStream(contentPath));

    return [
      {
        connectorKind: this.identity.kind,
        sourceType: SourceType.VIDEO,
        originalName: basename(input.filename),
        contentPath,
        contentType: input.mimetype || `video/${extension}`,
        ephemeral: true,
        checkpoint: null,
        version: null,
        metadata: {
          extension,
          origin: 'multipart-upload',
        },
      },
    ];
  }
}

import { Service } from 'typedi';
import { LocalFilesystemVideoConnector } from './local-filesystem.connector';
import { LocalUploadVideoConnector } from './local-upload.connector';
import type { ConnectorKind, SourceConnector } from './types';

/**
 * Resolves the concrete connector for a kind.
 * Future kinds can be registered here without touching the ingest pipeline.
 */
@Service()
export class SourceConnectorRegistry {
  constructor(
    private readonly localUpload: LocalUploadVideoConnector,
    private readonly localFilesystem: LocalFilesystemVideoConnector,
  ) {}

  get(kind: ConnectorKind): SourceConnector {
    switch (kind) {
      case 'local-upload':
        return this.localUpload;
      case 'local-filesystem':
        return this.localFilesystem;
      default: {
        const exhaustive: never = kind;
        throw new Error(`Unsupported connector kind: ${String(exhaustive)}`);
      }
    }
  }

  list(): SourceConnector[] {
    return [this.localUpload, this.localFilesystem];
  }
}

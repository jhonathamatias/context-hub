import type { FastifyBaseLogger } from 'fastify';
import type { SourceType } from '../database/enums';

/**
 * Implemented now: local-upload, local-filesystem, onedrive.
 * Reserved for later (do not implement without validated need):
 * youtube | github | jira | jenkins | sentry
 */
export type ConnectorKind = 'local-upload' | 'local-filesystem' | 'onedrive';

export type SourceConnectorIdentity = {
  kind: ConnectorKind;
  label: string;
};

export type CollectedSourceItem = {
  /** Connector that produced this item. */
  connectorKind: ConnectorKind;
  /** Domain source type for persistence/pipeline routing. */
  sourceType: SourceType;
  /** Human-readable name (file name, lesson title, …). */
  originalName: string;
  /** Absolute path to collected content ready for the pipeline. */
  contentPath: string;
  /** MIME / media hint. */
  contentType: string;
  /**
   * When true, the pipeline owns cleanup of contentPath after copy
   * (e.g. upload temp files). Filesystem sources keep the original.
   */
  ephemeral: boolean;
  /** Incremental sync cursor when the connector supports it. */
  checkpoint?: string | null;
  /** Version / etag / mtime fingerprint when available. */
  version?: string | null;
  metadata?: Record<string, unknown>;
};

export type CollectContext = {
  logger: FastifyBaseLogger;
};

/**
 * Port for bringing external material into the hub.
 * Collect only — persistence and media processing stay in the pipeline.
 */
export interface SourceConnector<TInput = unknown> {
  readonly identity: SourceConnectorIdentity;
  supports(input: unknown): boolean;
  collect(
    input: TInput,
    context: CollectContext,
  ): Promise<CollectedSourceItem[]>;
}

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { env } from '../config/env';

export type IngestOrigin = {
  kind: 'onedrive';
  shareUrl: string;
  itemId: string;
  /** Never persist access tokens here. */
  originalName?: string;
};

export function ingestOriginPath(sourceId: string): string {
  return join(env.storageDir, 'sources', sourceId, 'ingest-origin.json');
}

export async function writeIngestOrigin(
  sourceId: string,
  origin: IngestOrigin,
): Promise<void> {
  await writeFile(ingestOriginPath(sourceId), JSON.stringify(origin), 'utf8');
}

export async function readIngestOrigin(
  sourceId: string,
): Promise<IngestOrigin | null> {
  try {
    const raw = JSON.parse(
      await readFile(ingestOriginPath(sourceId), 'utf8'),
    ) as IngestOrigin;
    if (raw?.kind !== 'onedrive' || !raw.shareUrl || !raw.itemId) return null;
    return raw;
  } catch {
    return null;
  }
}

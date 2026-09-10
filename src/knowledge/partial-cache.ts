import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { env } from '../config/env';
import type { StoredPartialKnowledge } from './partial-cache-key';

export type {
  PartialKnowledgeCacheKeyInput,
  StoredPartialKnowledge,
} from './partial-cache-key';
export {
  buildPartialCacheKey,
  hashChunkGroupContent,
  KNOWLEDGE_MAP_VERSION,
} from './partial-cache-key';

function partialsDir(sourceId: string): string {
  return join(env.storageDir, 'sources', sourceId, 'knowledge-partials');
}

function partialPath(sourceId: string, cacheKey: string): string {
  return join(partialsDir(sourceId), `${cacheKey}.json`);
}

export async function readPartialKnowledge(
  sourceId: string,
  cacheKey: string,
): Promise<StoredPartialKnowledge | null> {
  try {
    const raw = await readFile(partialPath(sourceId, cacheKey), 'utf8');
    return JSON.parse(raw) as StoredPartialKnowledge;
  } catch {
    return null;
  }
}

export async function writePartialKnowledge(
  record: StoredPartialKnowledge,
  cacheKey: string,
): Promise<void> {
  const dir = partialsDir(record.sourceId);
  await mkdir(dir, { recursive: true });
  await writeFile(
    partialPath(record.sourceId, cacheKey),
    JSON.stringify(record, null, 2),
    'utf8',
  );
}

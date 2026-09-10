import { createHash } from 'node:crypto';
import type { PartialLessonKnowledge } from './partial-knowledge.schema';

export const KNOWLEDGE_MAP_VERSION = 'map-v1';

export type PartialKnowledgeCacheKeyInput = {
  sourceId: string;
  chunkStart: number;
  chunkEnd: number;
  contentHash: string;
  provider: string;
  model: string;
  version?: string;
};

export type StoredPartialKnowledge = {
  sourceId: string;
  groupIndex: number;
  chunkStart: number;
  chunkEnd: number;
  contentHash: string;
  provider: string;
  model: string;
  version: string;
  knowledge: PartialLessonKnowledge;
  createdAt: string;
};

export function hashChunkGroupContent(
  texts: readonly string[],
): string {
  const hash = createHash('sha256');
  for (const text of texts) {
    hash.update(text);
    hash.update('\0');
  }
  return hash.digest('hex').slice(0, 32);
}

export function buildPartialCacheKey(
  input: PartialKnowledgeCacheKeyInput,
): string {
  const version = input.version ?? KNOWLEDGE_MAP_VERSION;
  const raw = [
    version,
    input.sourceId,
    String(input.chunkStart),
    String(input.chunkEnd),
    input.contentHash,
    input.provider,
    input.model,
  ].join('|');
  return createHash('sha256').update(raw).digest('hex').slice(0, 40);
}

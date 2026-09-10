import type { TranscriptChunkDraft } from './chunking';

export type KnowledgeChunkGroup = {
  groupIndex: number;
  chunkStart: number;
  chunkEnd: number;
  chunks: TranscriptChunkDraft[];
};

export type GroupChunksOptions = {
  maxChunksPerGroup: number;
  maxCharsPerGroup: number;
};

/**
 * Split transcript chunks into contiguous MAP groups (no sampling / dropping).
 */
export function groupChunksForMap(
  chunks: TranscriptChunkDraft[],
  options: GroupChunksOptions,
): KnowledgeChunkGroup[] {
  if (chunks.length === 0) {
    return [];
  }

  const maxChunks = Math.max(1, options.maxChunksPerGroup);
  const maxChars = Math.max(500, options.maxCharsPerGroup);
  const groups: KnowledgeChunkGroup[] = [];
  let current: TranscriptChunkDraft[] = [];
  let currentChars = 0;
  let groupIndex = 0;

  const flush = () => {
    if (current.length === 0) {
      return;
    }
    const start = current[0]!.chunkIndex;
    const end = current[current.length - 1]!.chunkIndex;
    groups.push({
      groupIndex,
      chunkStart: start,
      chunkEnd: end,
      chunks: current,
    });
    groupIndex += 1;
    current = [];
    currentChars = 0;
  };

  for (const chunk of chunks) {
    const textLen = chunk.normalizedText.length || chunk.text.length;
    const wouldExceed =
      current.length > 0 &&
      (current.length >= maxChunks || currentChars + textLen > maxChars);

    if (wouldExceed) {
      flush();
    }

    current.push(chunk);
    currentChars += textLen;
  }

  flush();
  return groups;
}

import type { KnowledgeChunkGroup } from './map-groups';
import { structuredLessonKnowledgeJsonSchema } from './knowledge.schema';
import { partialLessonKnowledgeJsonSchema } from './partial-knowledge.schema';
import type { PartialLessonKnowledge } from './partial-knowledge.schema';

const MAX_CHUNK_TEXT = 600;

/**
 * MAP prompt: extract partial knowledge from one contiguous chunk group.
 * Timestamps must come from the provided chunks only.
 */
export function buildMapKnowledgePrompt(input: {
  sourceId: string;
  language: string | null;
  group: KnowledgeChunkGroup;
  totalGroups: number;
}): { system: string; user: string } {
  const timedChunks = input.group.chunks.map((chunk) => ({
    index: chunk.chunkIndex,
    startSeconds: chunk.startSeconds,
    endSeconds: chunk.endSeconds,
    text: truncateEnd(chunk.normalizedText || chunk.text, MAX_CHUNK_TEXT),
  }));

  return {
    system: [
      'You extract partial structured study notes from one section of a guitar lesson transcript.',
      'This is a MAP step: cover only the provided chunks; do not invent missing sections.',
      'Never invent timestamps — only use startSeconds/endSeconds from the given chunks.',
      'Prefer null timestamps over guessed ones.',
      'Keep arrays concise (prefer the most important items).',
      'Respond with a single complete JSON object matching this shape:',
      JSON.stringify(partialLessonKnowledgeJsonSchema),
      'Do not wrap the JSON in markdown fences.',
    ].join(' '),
    user: JSON.stringify({
      sourceId: input.sourceId,
      language: input.language,
      groupIndex: input.group.groupIndex,
      totalGroups: input.totalGroups,
      chunkStart: input.group.chunkStart,
      chunkEnd: input.group.chunkEnd,
      chunks: timedChunks,
    }),
  };
}

/**
 * REDUCE prompt: consolidate MAP partials only (no raw transcript).
 */
export function buildReduceKnowledgePrompt(input: {
  sourceId: string;
  language: string | null;
  partials: Array<{
    groupIndex: number;
    chunkStart: number;
    chunkEnd: number;
    knowledge: PartialLessonKnowledge;
  }>;
}): { system: string; user: string } {
  return {
    system: [
      'You consolidate partial guitar-lesson knowledge extracts into one final study note.',
      'You receive ONLY partial JSON results from MAP groups — not the full transcript.',
      'Deduplicate topics, concepts, techniques, and exercises (merge near-duplicates).',
      'Preserve the most relevant timestamps from the partials; never invent new timestamps.',
      'Write a clear suggestedTitle and summary covering the whole lesson.',
      'Respond with a single complete JSON object matching this shape:',
      JSON.stringify(structuredLessonKnowledgeJsonSchema),
      'Do not wrap the JSON in markdown fences.',
    ].join(' '),
    user: JSON.stringify({
      sourceId: input.sourceId,
      language: input.language,
      partials: input.partials,
    }),
  };
}

function truncateEnd(value: string, maxChars: number): string {
  if (value.length <= maxChars) {
    return value;
  }
  return `${value.slice(0, maxChars - 1)}…`;
}

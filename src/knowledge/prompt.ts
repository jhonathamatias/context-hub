import type { KnowledgeExtractionInput } from './types';
import { structuredLessonKnowledgeJsonSchema } from './knowledge.schema';

export function buildKnowledgeExtractionPrompt(
  input: KnowledgeExtractionInput,
): { system: string; user: string } {
  const timedChunks = input.chunks.map((chunk) => ({
    index: chunk.chunkIndex,
    startSeconds: chunk.startSeconds,
    endSeconds: chunk.endSeconds,
    text: chunk.normalizedText,
  }));

  return {
    system: [
      'You extract structured study notes from guitar lesson transcripts.',
      'Never invent content that is not supported by the transcript.',
      'Respond with a single JSON object matching this shape:',
      JSON.stringify(structuredLessonKnowledgeJsonSchema),
      'Every important item should include startSeconds/endSeconds when possible.',
      'Prefer null timestamps over guessed timestamps.',
    ].join(' '),
    user: JSON.stringify({
      sourceId: input.sourceId,
      language: input.language,
      fullText: input.fullText,
      chunks: timedChunks,
    }),
  };
}

import type { KnowledgeExtractionInput } from './types';
import { structuredLessonKnowledgeJsonSchema } from './knowledge.schema';

const MAX_FULL_TEXT_CHARS = 14_000;
const MAX_CHUNKS = 40;

/**
 * Keep prompts bounded so the model can finish a complete JSON object
 * within maxOutputTokens (long guitar lessons otherwise truncate mid-string).
 */
export function buildKnowledgeExtractionPrompt(
  input: KnowledgeExtractionInput,
): { system: string; user: string } {
  const fullText = truncateMiddle(input.fullText, MAX_FULL_TEXT_CHARS);
  const selectedChunks = sampleChunks(input.chunks, MAX_CHUNKS);
  const timedChunks = selectedChunks.map((chunk) => ({
    index: chunk.chunkIndex,
    startSeconds: chunk.startSeconds,
    endSeconds: chunk.endSeconds,
    text: truncateMiddle(chunk.normalizedText, 420),
  }));

  return {
    system: [
      'You extract structured study notes from guitar lesson transcripts.',
      'Never invent content that is not supported by the transcript.',
      'Keep arrays concise (prefer the most important items, max ~8 each).',
      'Respond with a single complete JSON object matching this shape:',
      JSON.stringify(structuredLessonKnowledgeJsonSchema),
      'Every important item should include startSeconds/endSeconds when possible.',
      'Prefer null timestamps over guessed timestamps.',
      'Do not wrap the JSON in markdown fences.',
    ].join(' '),
    user: JSON.stringify({
      sourceId: input.sourceId,
      language: input.language,
      fullText,
      chunks: timedChunks,
      note:
        input.fullText.length > MAX_FULL_TEXT_CHARS ||
        input.chunks.length > MAX_CHUNKS
          ? 'Transcript was truncated for length; focus on the provided excerpts.'
          : undefined,
    }),
  };
}

function sampleChunks<T>(items: T[], limit: number): T[] {
  if (items.length <= limit) {
    return items;
  }
  const result: T[] = [];
  const step = (items.length - 1) / (limit - 1);
  for (let i = 0; i < limit; i += 1) {
    const index = Math.round(i * step);
    result.push(items[index]!);
  }
  return result;
}

function truncateMiddle(value: string, maxChars: number): string {
  if (value.length <= maxChars) {
    return value;
  }
  const head = Math.floor(maxChars * 0.65);
  const tail = maxChars - head - 15;
  return `${value.slice(0, head)}\n…[truncated]…\n${value.slice(-tail)}`;
}

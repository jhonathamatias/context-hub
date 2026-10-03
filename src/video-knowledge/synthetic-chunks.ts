import { normalizeTranscriptText } from '../knowledge/chunking';
import type { TranscriptChunkDraft } from '../knowledge/chunking';
import type { StructuredLessonKnowledge } from '../knowledge/knowledge.schema';
import type { TranscriptionSegment } from '../transcription/types';

type TimedText = {
  text: string;
  startSeconds: number;
  endSeconds: number;
};

/**
 * Builds synthetic transcript segments/chunks from multimodal knowledge
 * so embeddings + transcript UI keep working without Whisper.
 */
export function knowledgeToSyntheticSegments(
  knowledge: StructuredLessonKnowledge,
): TranscriptionSegment[] {
  const items: TimedText[] = [];

  for (const topic of knowledge.topics) {
    items.push({
      text: topic,
      startSeconds: 0,
      endSeconds: 0,
    });
  }

  const pushNamed = (
    rows: Array<{
      name: string;
      description?: string | undefined;
      startSeconds?: number | null | undefined;
      endSeconds?: number | null | undefined;
    }>,
  ) => {
    for (const row of rows) {
      const start = row.startSeconds ?? 0;
      const end = row.endSeconds ?? start;
      const body = row.description
        ? `${row.name}: ${row.description}`
        : row.name;
      items.push({ text: body, startSeconds: start, endSeconds: end });
    }
  };

  pushNamed(knowledge.concepts);
  pushNamed(knowledge.techniques);
  pushNamed(knowledge.theoryHarmony);
  pushNamed(knowledge.scalesArpeggiosChords);

  for (const row of knowledge.exercises) {
    const start = row.startSeconds ?? 0;
    items.push({
      text: row.description,
      startSeconds: start,
      endSeconds: row.endSeconds ?? start,
    });
  }
  for (const row of knowledge.licksOrPracticalIdeas) {
    const start = row.startSeconds ?? 0;
    items.push({
      text: row.description,
      startSeconds: start,
      endSeconds: row.endSeconds ?? start,
    });
  }
  for (const row of knowledge.teacherRecommendations) {
    const start = row.startSeconds ?? 0;
    items.push({
      text: row.text,
      startSeconds: start,
      endSeconds: row.endSeconds ?? start,
    });
  }
  for (const row of knowledge.reviewQuestions) {
    const start = row.startSeconds ?? 0;
    items.push({
      text: row.question,
      startSeconds: start,
      endSeconds: row.endSeconds ?? start,
    });
  }

  if (items.length === 0) {
    items.push({
      text: `${knowledge.suggestedTitle}. ${knowledge.summary}`,
      startSeconds: 0,
      endSeconds: 0,
    });
  }

  return items.map((item) => ({
    startSeconds: item.startSeconds,
    endSeconds: Math.max(item.endSeconds, item.startSeconds),
    text: item.text.trim(),
  }));
}

export function knowledgeToSyntheticChunks(
  knowledge: StructuredLessonKnowledge,
): TranscriptChunkDraft[] {
  const segments = knowledgeToSyntheticSegments(knowledge);
  return segments.map((segment, index) => {
    const text = segment.text;
    return {
      chunkIndex: index,
      text,
      normalizedText: normalizeTranscriptText(text),
      startSeconds: segment.startSeconds,
      endSeconds: segment.endSeconds,
    };
  });
}

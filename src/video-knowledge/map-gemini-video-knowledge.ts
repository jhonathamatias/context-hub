import {
  structuredLessonKnowledgeSchema,
  type StructuredLessonKnowledge,
} from '../knowledge/knowledge.schema';
import { parseLlmJsonObject } from '../llm/parse-llm-json';

/**
 * Maps raw model JSON into domain StructuredLessonKnowledge.
 * Throws on invalid shape — never returns vendor-specific types.
 */
export function mapToStructuredLessonKnowledge(
  raw: unknown,
): StructuredLessonKnowledge {
  const parsed =
    typeof raw === 'string' ? parseLlmJsonObject(raw) : raw;
  return structuredLessonKnowledgeSchema.parse(parsed);
}

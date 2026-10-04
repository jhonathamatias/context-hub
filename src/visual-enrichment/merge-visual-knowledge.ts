import type { StructuredLessonKnowledge } from '../knowledge/knowledge.schema';
import type { VisualClipKnowledge } from '../poc/remote-multimodal/visual-clip-types';

function normalizeKey(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function overlapsExisting(
  description: string,
  knowledge: StructuredLessonKnowledge,
): boolean {
  const key = normalizeKey(description);
  if (!key) return true;
  const corpus = [
    ...knowledge.concepts.map((c) => `${c.name} ${c.description ?? ''}`),
    ...knowledge.techniques.map((t) => `${t.name} ${t.description ?? ''}`),
    ...knowledge.licksOrPracticalIdeas.map((l) => l.description),
    ...knowledge.visualInsights.map((v) => v.description),
  ]
    .map(normalizeKey)
    .join(' | ');

  const tokens = key.split(' ').filter((w) => w.length > 3);
  if (tokens.length === 0) return false;
  let hit = 0;
  for (const t of tokens) {
    if (corpus.includes(t)) hit += 1;
  }
  return hit / tokens.length >= 0.7;
}

/**
 * Merge clip visual knowledge into text StructuredLessonKnowledge.
 * Prefer enrichment over duplicate rows.
 */
export function mergeVisualIntoLessonKnowledge(
  textKnowledge: StructuredLessonKnowledge,
  clips: VisualClipKnowledge[],
): StructuredLessonKnowledge {
  const merged: StructuredLessonKnowledge = {
    ...textKnowledge,
    techniques: [...textKnowledge.techniques],
    licksOrPracticalIdeas: [...textKnowledge.licksOrPracticalIdeas],
    visualInsights: [...(textKnowledge.visualInsights ?? [])],
  };

  for (const clip of clips) {
    for (const finding of clip.visualFindings) {
      const description = finding.description.trim();
      if (!description) continue;
      if (finding.classification === 'DUPLICATE_OF_TRANSCRIPT') continue;
      if (overlapsExisting(description, merged)) {
        // Enrich matching technique description when possible.
        const tech = merged.techniques.find((t) =>
          normalizeKey(`${t.name} ${t.description ?? ''}`).includes(
            normalizeKey(description).split(' ').slice(0, 3).join(' '),
          ),
        );
        if (tech && !(tech.description ?? '').includes(description)) {
          tech.description = [tech.description, `[visual] ${description}`]
            .filter(Boolean)
            .join(' ');
          if (tech.startSeconds == null && finding.absoluteStartSeconds != null) {
            tech.startSeconds = finding.absoluteStartSeconds;
          }
          if (tech.endSeconds == null && finding.absoluteEndSeconds != null) {
            tech.endSeconds = finding.absoluteEndSeconds;
          }
        }
        continue;
      }

      const start =
        finding.absoluteStartSeconds ?? clip.clipStartSeconds ?? null;
      const end = finding.absoluteEndSeconds ?? clip.clipEndSeconds ?? null;

      merged.visualInsights.push({
        type: finding.type || 'visual',
        description,
        startSeconds: start,
        endSeconds: end,
        confidence: finding.confidence ?? null,
        provenance: 'visual',
      });

      if (finding.classification === 'NEW_VISUAL_INFORMATION') {
        merged.licksOrPracticalIdeas.push({
          description: `[visual] ${description}`,
          startSeconds: start,
          endSeconds: end,
        });
      }
    }
  }

  return merged;
}

/** Build embeddable chunk drafts from visual insights. */
export function visualInsightsToChunkDrafts(
  knowledge: StructuredLessonKnowledge,
  startChunkIndex: number,
): Array<{
  chunkIndex: number;
  text: string;
  normalizedText: string;
  startSeconds: number;
  endSeconds: number;
}> {
  const drafts = [];
  let index = startChunkIndex;
  for (const insight of knowledge.visualInsights ?? []) {
    const start = insight.startSeconds ?? 0;
    const end = insight.endSeconds ?? start;
    const text = `[visual:${insight.type}] ${insight.description}`;
    drafts.push({
      chunkIndex: index,
      text,
      normalizedText: text.replace(/\s+/g, ' ').trim(),
      startSeconds: start,
      endSeconds: Math.max(end, start),
    });
    index += 1;
  }
  return drafts;
}

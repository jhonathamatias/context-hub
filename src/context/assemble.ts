import type { SemanticSearchHit } from '../search';
import type { AssembledContext, ContextCitation } from './types';

function formatTimestamp(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function assembleContext(
  hits: SemanticSearchHit[],
  options: { maxChars: number; minScore: number },
): AssembledContext {
  const passages: ContextCitation[] = [];
  const blocks: string[] = [];
  let totalChars = 0;

  for (const hit of hits) {
    const excerpt = hit.normalizedText.trim();
    if (!excerpt) {
      continue;
    }

    const citation: ContextCitation = {
      index: passages.length + 1,
      sourceId: hit.sourceId,
      sourceName: hit.sourceName,
      chunkId: hit.chunkId,
      startSeconds: hit.startSeconds,
      endSeconds: hit.endSeconds,
      score: hit.score,
      excerpt,
    };

    const block = [
      `[${citation.index}] aula="${citation.sourceName}" sourceId=${citation.sourceId}`,
      `tempo=${formatTimestamp(citation.startSeconds)}-${formatTimestamp(citation.endSeconds)} score=${citation.score.toFixed(3)}`,
      excerpt,
    ].join('\n');

    if (passages.length > 0 && totalChars + block.length + 2 > options.maxChars) {
      break;
    }

    passages.push(citation);
    blocks.push(block);
    totalChars += block.length + (blocks.length > 1 ? 2 : 0);
  }

  const bestScore = passages[0]?.score ?? 0;
  const sufficientEvidence =
    passages.length > 0 && bestScore >= options.minScore;

  return {
    passages,
    promptBlock: blocks.join('\n\n'),
    totalChars,
    sufficientEvidence,
  };
}

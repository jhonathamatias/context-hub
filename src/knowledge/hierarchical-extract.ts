import type { LlmProvider } from '../llm/types';
import { mapWithConcurrency } from '../llm/concurrency';
import { parseLlmJsonObject } from '../llm/parse-llm-json';
import {
  structuredLessonKnowledgeSchema,
  type StructuredLessonKnowledge,
} from './knowledge.schema';
import { groupChunksForMap } from './map-groups';
import {
  buildPartialCacheKey,
  hashChunkGroupContent,
  KNOWLEDGE_MAP_VERSION,
  type StoredPartialKnowledge,
} from './partial-cache-key';
import {
  partialLessonKnowledgeSchema,
  type PartialLessonKnowledge,
} from './partial-knowledge.schema';
import {
  buildMapKnowledgePrompt,
  buildReduceKnowledgePrompt,
} from './prompt';
import type { KnowledgeExtractionInput } from './types';

export type PartialKnowledgeStore = {
  read(cacheKey: string): Promise<StoredPartialKnowledge | null>;
  write(
    cacheKey: string,
    record: StoredPartialKnowledge,
  ): Promise<void>;
};

export type HierarchicalExtractOptions = {
  llm: LlmProvider;
  input: KnowledgeExtractionInput;
  concurrency: number;
  mapMaxChunks: number;
  mapMaxChars: number;
  store: PartialKnowledgeStore;
  onLog?: (fields: Record<string, unknown>, message: string) => void;
};

export async function extractHierarchicalKnowledge(
  options: HierarchicalExtractOptions,
): Promise<StructuredLessonKnowledge> {
  const { llm, input, store, onLog } = options;
  const groups = groupChunksForMap(input.chunks, {
    maxChunksPerGroup: options.mapMaxChunks,
    maxCharsPerGroup: options.mapMaxChars,
  });

  if (groups.length === 0) {
    throw new Error('Cannot extract knowledge: no transcript chunks');
  }

  const totalGroups = groups.length;
  const startedAt = Date.now();

  const partialRecords = await mapWithConcurrency(
    groups,
    options.concurrency,
    async (group) => {
      const contentHash = hashChunkGroupContent(
        group.chunks.map((c) => c.normalizedText || c.text),
      );
      const cacheKey = buildPartialCacheKey({
        sourceId: input.sourceId,
        chunkStart: group.chunkStart,
        chunkEnd: group.chunkEnd,
        contentHash,
        provider: llm.name,
        model: llm.model,
      });

      const cached = await store.read(cacheKey);
      if (cached) {
        onLog?.(
          {
            sourceId: input.sourceId,
            operation: 'knowledge.map',
            provider: llm.name,
            model: llm.model,
            group: group.groupIndex,
            totalGroups,
            cacheHit: true,
          },
          'knowledge map cache hit',
        );
        return {
          groupIndex: group.groupIndex,
          chunkStart: group.chunkStart,
          chunkEnd: group.chunkEnd,
          knowledge: cached.knowledge,
        };
      }

      const prompt = buildMapKnowledgePrompt({
        sourceId: input.sourceId,
        language: input.language,
        group,
        totalGroups,
      });

      const mapStarted = Date.now();
      const result = await llm.generateJson({
        useCase: 'knowledge_extraction',
        temperature: 0.2,
        maxOutputTokens: 4096,
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user },
        ],
      });

      const knowledge = parsePartial(result.content);
      await store.write(cacheKey, {
        sourceId: input.sourceId,
        groupIndex: group.groupIndex,
        chunkStart: group.chunkStart,
        chunkEnd: group.chunkEnd,
        contentHash,
        provider: result.provider,
        model: result.model,
        version: KNOWLEDGE_MAP_VERSION,
        knowledge,
        createdAt: new Date().toISOString(),
      });

      onLog?.(
        {
          sourceId: input.sourceId,
          operation: 'knowledge.map',
          provider: result.provider,
          model: result.model,
          group: group.groupIndex,
          totalGroups,
          attempt: result.attempts,
          durationMs: Date.now() - mapStarted,
          cacheHit: false,
        },
        'knowledge map group completed',
      );

      return {
        groupIndex: group.groupIndex,
        chunkStart: group.chunkStart,
        chunkEnd: group.chunkEnd,
        knowledge,
      };
    },
  );

  const reducePrompt = buildReduceKnowledgePrompt({
    sourceId: input.sourceId,
    language: input.language,
    partials: partialRecords,
  });

  const reduceStarted = Date.now();
  const reduceResult = await llm.generateJson({
    useCase: 'knowledge_extraction',
    temperature: 0.2,
    maxOutputTokens: 8192,
    messages: [
      { role: 'system', content: reducePrompt.system },
      { role: 'user', content: reducePrompt.user },
    ],
  });

  onLog?.(
    {
      sourceId: input.sourceId,
      operation: 'knowledge.reduce',
      provider: reduceResult.provider,
      model: reduceResult.model,
      totalGroups,
      attempt: reduceResult.attempts,
      durationMs: Date.now() - reduceStarted,
      totalDurationMs: Date.now() - startedAt,
    },
    'knowledge reduce completed',
  );

  return parseFinal(reduceResult.content);
}

function parsePartial(content: string): PartialLessonKnowledge {
  let payload: unknown;
  try {
    payload = parseLlmJsonObject(content);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `${message}. Response length=${content.length}. Often caused by maxOutputTokens truncation.`,
    );
  }

  const parsed = partialLessonKnowledgeSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(
      `Partial knowledge failed schema validation: ${parsed.error.message}`,
    );
  }
  return parsed.data;
}

function parseFinal(content: string): StructuredLessonKnowledge {
  let payload: unknown;
  try {
    payload = parseLlmJsonObject(content);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `${message}. Response length=${content.length}. Often caused by maxOutputTokens truncation.`,
    );
  }

  const parsed = structuredLessonKnowledgeSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(
      `Knowledge payload failed schema validation: ${parsed.error.message}`,
    );
  }
  return parsed.data;
}

/** In-memory store for unit tests. */
export function createMemoryPartialStore(): PartialKnowledgeStore {
  const map = new Map<string, StoredPartialKnowledge>();
  return {
    async read(cacheKey) {
      return map.get(cacheKey) ?? null;
    },
    async write(cacheKey, record) {
      map.set(cacheKey, record);
    },
  };
}

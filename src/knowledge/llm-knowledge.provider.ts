import { Inject, Service } from 'typedi';
import { env } from '../config/env';
import { LLM_PROVIDER, type LlmProvider } from '../llm/types';
import {
  extractHierarchicalKnowledge,
  type PartialKnowledgeStore,
} from './hierarchical-extract';
import {
  readPartialKnowledge,
  writePartialKnowledge,
} from './partial-cache';
import type { StructuredLessonKnowledge } from './knowledge.schema';
import type {
  KnowledgeExtractionInput,
  KnowledgeExtractionProvider,
} from './types';

function createDiskPartialStore(sourceId: string): PartialKnowledgeStore {
  return {
    read: (cacheKey) => readPartialKnowledge(sourceId, cacheKey),
    write: (cacheKey, record) => writePartialKnowledge(record, cacheKey),
  };
}

/**
 * Use-case adapter: hierarchical MAP→REDUCE via LlmProvider only (no vendor SDK).
 */
@Service()
export class LlmKnowledgeExtractionProvider
  implements KnowledgeExtractionProvider
{
  constructor(
    @Inject(LLM_PROVIDER)
    private readonly llm: LlmProvider,
  ) {}

  get name(): string {
    return this.llm.name;
  }

  async extract(
    input: KnowledgeExtractionInput,
  ): Promise<StructuredLessonKnowledge> {
    return extractHierarchicalKnowledge({
      llm: this.llm,
      input,
      concurrency: env.llm.concurrency,
      mapMaxChunks: env.knowledge.mapMaxChunks,
      mapMaxChars: env.knowledge.mapMaxChars,
      store: createDiskPartialStore(input.sourceId),
    });
  }
}

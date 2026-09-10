import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { LlmProvider } from '../llm/types';
import {
  createMemoryPartialStore,
  extractHierarchicalKnowledge,
} from './hierarchical-extract';

/**
 * LlmKnowledgeExtractionProvider is a thin Typedi adapter over
 * extractHierarchicalKnowledge — cover the use-case here without loading env.
 */
describe('knowledge extraction (hierarchical adapter contract)', () => {
  it('extracts via mocked LlmProvider with map+reduce calls', async () => {
    let calls = 0;
    const llm: LlmProvider = {
      name: 'mock',
      model: 'mock-model',
      async generateJson(input) {
        calls += 1;
        const user = input.messages.find((m) => m.role === 'user')?.content ?? '';
        if (user.includes('"partials"')) {
          return {
            content: JSON.stringify({
              suggestedTitle: 'Lesson',
              summary: 'A short summary',
              topics: ['a'],
              concepts: [{ name: 'Concept', description: 'Why it matters' }],
              techniques: [],
              theoryHarmony: [],
              scalesArpeggiosChords: [],
              exercises: [],
              licksOrPracticalIdeas: [],
              teacherRecommendations: [],
              reviewQuestions: [],
            }),
            model: 'mock-model',
            provider: 'mock',
            useCase: 'knowledge_extraction',
            usage: {
              promptTokens: 10,
              completionTokens: 20,
              totalTokens: 30,
              estimatedCostUsd: null,
            },
            latencyMs: 1,
            attempts: 1,
          };
        }
        return {
          content: JSON.stringify({
            topics: ['a'],
            concepts: [{ name: 'Concept' }],
            techniques: [],
            theoryHarmony: [],
            scalesArpeggiosChords: [],
            exercises: [],
            licksOrPracticalIdeas: [],
            teacherRecommendations: [],
            reviewQuestions: [],
            importantPoints: [],
          }),
          model: 'mock-model',
          provider: 'mock',
          useCase: 'knowledge_extraction',
          usage: {
            promptTokens: 10,
            completionTokens: 20,
            totalTokens: 30,
            estimatedCostUsd: null,
          },
          latencyMs: 1,
          attempts: 1,
        };
      },
    };

    const knowledge = await extractHierarchicalKnowledge({
      llm,
      input: {
        sourceId: 'src-1',
        language: 'pt',
        fullText: 'Hello world from the lesson.',
        segments: [],
        chunks: [
          {
            chunkIndex: 0,
            startSeconds: 0,
            endSeconds: 5,
            text: 'Hello world from the lesson.',
            normalizedText: 'hello world from the lesson',
          },
        ],
      },
      concurrency: 1,
      mapMaxChunks: 40,
      mapMaxChars: 14_000,
      store: createMemoryPartialStore(),
    });

    assert.equal(knowledge.suggestedTitle, 'Lesson');
    assert.equal(calls, 2);
  });
});

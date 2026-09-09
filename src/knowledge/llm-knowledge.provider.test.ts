import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { LlmProvider } from '../llm/types';
import { LlmKnowledgeExtractionProvider } from './llm-knowledge.provider';

describe('LlmKnowledgeExtractionProvider', () => {
  it('extracts structured knowledge via a mocked LlmProvider (no vendor SDK)', async () => {
    let calledWith: unknown;
    const llm: LlmProvider = {
      name: 'mock',
      model: 'mock-model',
      async generateJson(input) {
        calledWith = input;
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
      },
    };

    const provider = new LlmKnowledgeExtractionProvider(llm);
    const knowledge = await provider.extract({
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
    });

    assert.equal(provider.name, 'mock');
    assert.equal(knowledge.suggestedTitle, 'Lesson');
    assert.ok(calledWith && typeof calledWith === 'object');
    assert.equal(
      (calledWith as { useCase: string }).useCase,
      'knowledge_extraction',
    );
    assert.equal(
      (calledWith as { messages: unknown[] }).messages.length,
      2,
    );
  });
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { LlmProvider } from '../llm/types';
import {
  createMemoryPartialStore,
  extractHierarchicalKnowledge,
} from './hierarchical-extract';
import { groupChunksForMap } from './map-groups';
import type { TranscriptChunkDraft } from './chunking';

function chunk(
  index: number,
  text: string,
  start: number,
  end: number,
): TranscriptChunkDraft {
  return {
    chunkIndex: index,
    startSeconds: start,
    endSeconds: end,
    text,
    normalizedText: text.toLowerCase(),
  };
}

const emptyPartial = {
  topics: ['t'],
  concepts: [],
  techniques: [],
  theoryHarmony: [],
  scalesArpeggiosChords: [],
  exercises: [],
  licksOrPracticalIdeas: [],
  teacherRecommendations: [],
  reviewQuestions: [],
  importantPoints: [],
};

const finalKnowledge = {
  suggestedTitle: 'Lesson',
  summary: 'Summary of the whole lesson',
  topics: ['t'],
  concepts: [],
  techniques: [],
  theoryHarmony: [],
  scalesArpeggiosChords: [],
  exercises: [],
  licksOrPracticalIdeas: [],
  teacherRecommendations: [],
  reviewQuestions: [],
};

describe('groupChunksForMap', () => {
  it('groups contiguous chunks without dropping any', () => {
    const chunks = Array.from({ length: 25 }, (_, i) =>
      chunk(i, `chunk text ${i} `.repeat(20), i * 10, i * 10 + 9),
    );
    const groups = groupChunksForMap(chunks, {
      maxChunksPerGroup: 10,
      maxCharsPerGroup: 100_000,
    });
    const covered = groups.flatMap((g) => g.chunks.map((c) => c.chunkIndex));
    assert.deepEqual(covered, chunks.map((c) => c.chunkIndex));
    assert.ok(groups.length >= 3);
  });
});

describe('extractHierarchicalKnowledge', () => {
  it('runs MAP then REDUCE and reuses cached partials', async () => {
    const calls: string[] = [];
    const llm: LlmProvider = {
      name: 'mock',
      model: 'mock-model',
      async generateJson(input) {
        const user = input.messages.find((m) => m.role === 'user')?.content ?? '';
        if (user.includes('"partials"')) {
          calls.push('reduce');
          return {
            content: JSON.stringify(finalKnowledge),
            model: 'mock-model',
            provider: 'mock',
            useCase: 'knowledge_extraction',
            usage: {
              promptTokens: null,
              completionTokens: null,
              totalTokens: null,
              estimatedCostUsd: null,
            },
            latencyMs: 1,
            attempts: 1,
          };
        }
        calls.push('map');
        return {
          content: JSON.stringify(emptyPartial),
          model: 'mock-model',
          provider: 'mock',
          useCase: 'knowledge_extraction',
          usage: {
            promptTokens: null,
            completionTokens: null,
            totalTokens: null,
            estimatedCostUsd: null,
          },
          latencyMs: 1,
          attempts: 1,
        };
      },
    };

    const store = createMemoryPartialStore();
    const chunks = [
      chunk(0, 'first section about scales', 0, 30),
      chunk(1, 'second section about chords', 30, 60),
      chunk(2, 'third section about improvisation', 60, 90),
    ];

    const first = await extractHierarchicalKnowledge({
      llm,
      input: {
        sourceId: 'src-1',
        language: 'pt',
        fullText: chunks.map((c) => c.text).join(' '),
        segments: [],
        chunks,
      },
      concurrency: 2,
      mapMaxChunks: 1,
      mapMaxChars: 10_000,
      store,
    });

    assert.equal(first.suggestedTitle, 'Lesson');
    assert.equal(calls.filter((c) => c === 'map').length, 3);
    assert.equal(calls.filter((c) => c === 'reduce').length, 1);

    calls.length = 0;
    const second = await extractHierarchicalKnowledge({
      llm,
      input: {
        sourceId: 'src-1',
        language: 'pt',
        fullText: chunks.map((c) => c.text).join(' '),
        segments: [],
        chunks,
      },
      concurrency: 1,
      mapMaxChunks: 1,
      mapMaxChars: 10_000,
      store,
    });

    assert.equal(second.summary, first.summary);
    assert.equal(calls.filter((c) => c === 'map').length, 0);
    assert.equal(calls.filter((c) => c === 'reduce').length, 1);
  });

  it('preserves timestamps from map partials into reduce input', async () => {
    let reduceUser = '';
    const llm: LlmProvider = {
      name: 'mock',
      model: 'm',
      async generateJson(input) {
        const user = input.messages.find((m) => m.role === 'user')?.content ?? '';
        if (user.includes('"partials"')) {
          reduceUser = user;
          return {
            content: JSON.stringify(finalKnowledge),
            model: 'm',
            provider: 'mock',
            useCase: 'knowledge_extraction',
            usage: {
              promptTokens: null,
              completionTokens: null,
              totalTokens: null,
              estimatedCostUsd: null,
            },
            latencyMs: 1,
            attempts: 1,
          };
        }
        return {
          content: JSON.stringify({
            ...emptyPartial,
            concepts: [
              {
                name: 'Pentatônica',
                startSeconds: 12,
                endSeconds: 40,
              },
            ],
          }),
          model: 'm',
          provider: 'mock',
          useCase: 'knowledge_extraction',
          usage: {
            promptTokens: null,
            completionTokens: null,
            totalTokens: null,
            estimatedCostUsd: null,
          },
          latencyMs: 1,
          attempts: 1,
        };
      },
    };

    await extractHierarchicalKnowledge({
      llm,
      input: {
        sourceId: 'src-2',
        language: 'pt',
        fullText: 'x',
        segments: [],
        chunks: [chunk(0, 'pentatonica maior', 10, 50)],
      },
      concurrency: 1,
      mapMaxChunks: 10,
      mapMaxChars: 10_000,
      store: createMemoryPartialStore(),
    });

    assert.match(reduceUser, /"startSeconds":12/);
    assert.match(reduceUser, /Pentatônica/);
  });
});

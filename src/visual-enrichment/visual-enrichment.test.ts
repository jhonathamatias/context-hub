import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { StructuredLessonKnowledge } from '../knowledge/knowledge.schema';
import type { VisualClipKnowledge } from '../poc/remote-multimodal/visual-clip-types';
import type { RankedVisualCandidate } from '../visual-candidates';
import {
  mergeVisualIntoLessonKnowledge,
  visualInsightsToChunkDrafts,
} from './merge-visual-knowledge';
import { selectTopVisualCandidates } from './select-top-candidates';

function baseKnowledge(): StructuredLessonKnowledge {
  return {
    suggestedTitle: 'Aula',
    summary: 'Resumo',
    topics: ['C7'],
    concepts: [{ name: 'C7', description: 'acorde dominante', startSeconds: 10 }],
    techniques: [],
    theoryHarmony: [],
    scalesArpeggiosChords: [],
    exercises: [],
    licksOrPracticalIdeas: [],
    teacherRecommendations: [],
    reviewQuestions: [],
    visualInsights: [],
  };
}

describe('selectTopVisualCandidates', () => {
  it('returns at most topN non-rejected by score', () => {
    const ranked: RankedVisualCandidate[] = [
      {
        startSeconds: 1,
        endSeconds: 10,
        reason: 'a',
        confidence: 0.5,
        triggers: [],
        score: 3,
        relevance: 'medium',
        scoreReasons: [],
        rejected: false,
        rejectionReasons: [],
        contextSnippet: '',
      },
      {
        startSeconds: 20,
        endSeconds: 30,
        reason: 'b',
        confidence: 0.9,
        triggers: [],
        score: 7,
        relevance: 'high',
        scoreReasons: [],
        rejected: false,
        rejectionReasons: [],
        contextSnippet: '',
      },
      {
        startSeconds: 40,
        endSeconds: 50,
        reason: 'c',
        confidence: 0.2,
        triggers: [],
        score: 9,
        relevance: 'high',
        scoreReasons: [],
        rejected: true,
        rejectionReasons: ['negated'],
        contextSnippet: '',
      },
    ];
    const top = selectTopVisualCandidates(ranked, 1);
    assert.equal(top.length, 1);
    assert.equal(top[0]?.score, 7);
  });

  it('returns empty when none kept', () => {
    assert.deepEqual(selectTopVisualCandidates([], 3), []);
  });
});

describe('mergeVisualIntoLessonKnowledge', () => {
  it('adds NEW_VISUAL findings as insights and licks', () => {
    const clip: VisualClipKnowledge = {
      clipStartSeconds: 100,
      clipEndSeconds: 120,
      summary: 'demo',
      losesImportantInfoWithoutVideo: true,
      losesImportantInfoReason: 'shapes',
      visualFindings: [
        {
          type: 'hand position',
          description: 'C7 shape on higher frets',
          absoluteStartSeconds: 105,
          absoluteEndSeconds: 115,
          confidence: 0.9,
          classification: 'NEW_VISUAL_INFORMATION',
        },
      ],
    };
    const merged = mergeVisualIntoLessonKnowledge(baseKnowledge(), [clip]);
    assert.equal(merged.visualInsights.length, 1);
    assert.equal(merged.visualInsights[0]?.provenance, 'visual');
    assert.ok(
      merged.licksOrPracticalIdeas.some((l) =>
        l.description.includes('[visual]'),
      ),
    );
    const chunks = visualInsightsToChunkDrafts(merged, 0);
    assert.equal(chunks.length, 1);
    assert.ok(chunks[0]!.text.includes('[visual:'));
    assert.equal(chunks[0]!.startSeconds, 105);
  });

  it('skips DUPLICATE_OF_TRANSCRIPT findings', () => {
    const clip: VisualClipKnowledge = {
      clipStartSeconds: 1,
      clipEndSeconds: 2,
      summary: 'x',
      losesImportantInfoWithoutVideo: false,
      losesImportantInfoReason: null,
      visualFindings: [
        {
          type: 'other',
          description: 'talking about C7',
          classification: 'DUPLICATE_OF_TRANSCRIPT',
        },
      ],
    };
    const merged = mergeVisualIntoLessonKnowledge(baseKnowledge(), [clip]);
    assert.equal(merged.visualInsights.length, 0);
  });
});

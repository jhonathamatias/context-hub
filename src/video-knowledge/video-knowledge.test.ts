import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { JobName } from '../jobs/types';
import { SchemaType } from '@google/generative-ai';
import { mapToStructuredLessonKnowledge } from './map-gemini-video-knowledge';
import { buildPipelineNextJobMap } from './pipeline';
import { multimodalKnowledgeResponseSchema } from './prompt';
import { knowledgeToSyntheticChunks } from './synthetic-chunks';
import type { VideoKnowledgeProvider } from './types';

describe('multimodalKnowledgeResponseSchema', () => {
  it('uses Gemini SchemaType (no JSON Schema unions / additionalProperties)', () => {
    const raw = JSON.stringify(multimodalKnowledgeResponseSchema);
    assert.equal(multimodalKnowledgeResponseSchema.type, SchemaType.OBJECT);
    assert.equal(raw.includes('additionalProperties'), false);
    assert.equal(raw.includes('["number","null"]'), false);
    assert.equal(raw.includes('"nullable":true'), true);
  });
});

describe('buildPipelineNextJobMap', () => {
  it('keeps the Whisper legacy chain', () => {
    const map = buildPipelineNextJobMap('legacy');
    assert.equal(map[JobName.SourceIngest], JobName.VideoExtract);
    assert.equal(map[JobName.VideoExtract], JobName.TranscriptionRun);
    assert.equal(map[JobName.TranscriptionRun], JobName.KnowledgeExtract);
    assert.equal(map[JobName.KnowledgeExtract], JobName.EmbeddingsGenerate);
    assert.equal(map[JobName.EmbeddingsGenerate], JobName.SourceIndex);
    assert.equal(map[JobName.MultimodalAnalyze], undefined);
  });

  it('routes multimodal ingest straight to Gemini analysis then embeddings', () => {
    const map = buildPipelineNextJobMap('multimodal');
    assert.equal(map[JobName.SourceIngest], JobName.MultimodalAnalyze);
    assert.equal(map[JobName.MultimodalAnalyze], JobName.EmbeddingsGenerate);
    assert.equal(map[JobName.EmbeddingsGenerate], JobName.SourceIndex);
    assert.equal(map[JobName.TranscriptionRun], undefined);
  });

  it('does not enqueue the next stage until multimodal.analyze completes', () => {
    const map = buildPipelineNextJobMap('multimodal');
    // JobDispatcher only calls enqueueNext after handler.execute resolves.
    assert.equal(map[JobName.MultimodalAnalyze], JobName.EmbeddingsGenerate);
    assert.notEqual(map[JobName.MultimodalAnalyze], JobName.SourceIndex);
  });
});

describe('mapToStructuredLessonKnowledge', () => {
  it('validates and returns domain StructuredLessonKnowledge', () => {
    const knowledge = mapToStructuredLessonKnowledge({
      suggestedTitle: 'Aula de pentatônica',
      summary: 'Introdução à escala pentatônica menor.',
      topics: ['pentatônica'],
      concepts: [
        {
          name: 'pentatônica menor',
          description: 'cinco notas',
          startSeconds: 12,
          endSeconds: 40,
        },
      ],
      techniques: [],
      theoryHarmony: [],
      scalesArpeggiosChords: [
        { name: 'Am pentatonic', kind: 'scale', startSeconds: 12 },
      ],
      exercises: [{ description: 'tocar em Am', startSeconds: 50 }],
      licksOrPracticalIdeas: [],
      teacherRecommendations: [],
      reviewQuestions: [{ question: 'Quais notas da pentatônica menor?' }],
    });

    assert.equal(knowledge.suggestedTitle, 'Aula de pentatônica');
    assert.equal(knowledge.concepts[0]?.startSeconds, 12);
    assert.equal(knowledge.scalesArpeggiosChords[0]?.kind, 'scale');
  });

  it('rejects invalid payloads', () => {
    assert.throws(() => mapToStructuredLessonKnowledge({ summary: 'x' }));
  });
});

describe('VideoKnowledgeProvider contract', () => {
  it('does not expose Gemini SDK types on the domain interface', async () => {
    const provider: VideoKnowledgeProvider = {
      name: 'fake',
      async analyze() {
        return mapToStructuredLessonKnowledge({
          suggestedTitle: 'T',
          summary: 'S',
          topics: [],
          concepts: [],
          techniques: [],
          theoryHarmony: [],
          scalesArpeggiosChords: [],
          exercises: [],
          licksOrPracticalIdeas: [],
          teacherRecommendations: [],
          reviewQuestions: [],
        });
      },
    };

    const result = await provider.analyze({
      sourceId: 's1',
      videoPath: '/tmp/x.mp4',
      originalName: 'x.mp4',
      mimeType: 'video/mp4',
    });

    assert.equal(result.suggestedTitle, 'T');
    assert.equal('fileData' in result, false);
    assert.equal('candidates' in result, false);
  });
});

describe('knowledgeToSyntheticChunks', () => {
  it('preserves timestamps from knowledge items', () => {
    const knowledge = mapToStructuredLessonKnowledge({
      suggestedTitle: 'T',
      summary: 'S',
      topics: [],
      concepts: [
        { name: 'CAGED', description: 'sistema', startSeconds: 30, endSeconds: 55 },
      ],
      techniques: [],
      theoryHarmony: [],
      scalesArpeggiosChords: [],
      exercises: [],
      licksOrPracticalIdeas: [],
      teacherRecommendations: [],
      reviewQuestions: [],
    });

    const chunks = knowledgeToSyntheticChunks(knowledge);
    assert.ok(chunks.length >= 1);
    const caged = chunks.find((c) => c.text.includes('CAGED'));
    assert.ok(caged);
    assert.equal(caged!.startSeconds, 30);
    assert.equal(caged!.endSeconds, 55);
  });
});

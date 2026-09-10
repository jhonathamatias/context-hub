import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ALL_JOB_NAMES, JobName } from './types';

describe('job names', () => {
  it('covers the required background pipeline stages', () => {
    assert.deepEqual(ALL_JOB_NAMES, [
      JobName.SourceIngest,
      JobName.VideoExtract,
      JobName.TranscriptionRun,
      JobName.KnowledgeExtract,
      JobName.EmbeddingsGenerate,
      JobName.SourceIndex,
    ]);
  });
});

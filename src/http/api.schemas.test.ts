import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SourceStatus } from '../database/enums';
import {
  chatBodySchema,
  listSourcesQuerySchema,
  parseInput,
  ValidationError,
} from '../http';
import { JobName } from '../jobs/types';
import { toPublicAcceptResult, toPublicQueuedResult } from '../sources/public-dto';

describe('listSourcesQuerySchema', () => {
  it('applies pagination defaults', () => {
    const parsed = parseInput(listSourcesQuerySchema, {});
    assert.equal(parsed.page, 1);
    assert.equal(parsed.pageSize, 20);
  });

  it('accepts status filter', () => {
    const parsed = parseInput(listSourcesQuerySchema, {
      page: '2',
      pageSize: '5',
      status: SourceStatus.READY,
    });
    assert.equal(parsed.page, 2);
    assert.equal(parsed.pageSize, 5);
    assert.equal(parsed.status, SourceStatus.READY);
  });
});

describe('chatBodySchema', () => {
  it('accepts question with optional history and source filters', () => {
    const parsed = parseInput(chatBodySchema, {
      question: 'Como praticar improvisação?',
      sourceIds: ['512b014f-7c61-4e49-9511-970aecdea526'],
      history: [{ role: 'user', content: 'oi' }],
    });
    assert.equal(parsed.question, 'Como praticar improvisação?');
    assert.equal(parsed.history?.length, 1);
  });

  it('rejects empty question', () => {
    assert.throws(
      () => parseInput(chatBodySchema, { question: '  ' }),
      ValidationError,
    );
  });
});

describe('public DTOs', () => {
  it('omits filesystem paths from accept responses', () => {
    const publicResult = toPublicAcceptResult({
      sourceId: 's1',
      jobId: 'j1',
      connectorKind: 'local-upload',
      originalName: 'aula.mp4',
      status: SourceStatus.PROCESSING,
      queuedJob: 'video.extract',
    });

    assert.equal(publicResult.queued, 'video.extract');
    assert.equal(
      Object.prototype.hasOwnProperty.call(publicResult, 'storageKey'),
      false,
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(publicResult, 'audioPath'),
      false,
    );
  });

  it('exposes queued pipeline jobs without internal paths', () => {
    const publicResult = toPublicQueuedResult({
      sourceId: 's1',
      queueJobId: 'q1',
      jobName: JobName.TranscriptionRun,
    });
    assert.equal(publicResult.status, 'queued');
    assert.equal(publicResult.queued, JobName.TranscriptionRun);
  });
});

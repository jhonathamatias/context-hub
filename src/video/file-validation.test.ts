import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  VideoValidationError,
  assertVideoFile,
  normalizeExtension,
} from './file-validation';

describe('normalizeExtension', () => {
  it('normalizes common video extensions', () => {
    assert.equal(normalizeExtension('lesson.MP4'), 'mp4');
    assert.equal(normalizeExtension('/tmp/video.WebM'), 'webm');
  });
});

describe('assertVideoFile', () => {
  it('rejects unsupported extensions', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'context-hub-video-'));
    const filePath = join(dir, 'notes.txt');
    await writeFile(filePath, 'not a video');

    await assert.rejects(
      () =>
        assertVideoFile(filePath, 'notes.txt', {
          maxBytes: 1024,
          allowedExtensions: ['mp4'],
        }),
      (error: unknown) =>
        error instanceof VideoValidationError &&
        error.message.includes('Unsupported video format'),
    );

    await rm(dir, { recursive: true, force: true });
  });

  it('rejects empty files', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'context-hub-video-'));
    const filePath = join(dir, 'empty.mp4');
    await writeFile(filePath, '');

    await assert.rejects(
      () =>
        assertVideoFile(filePath, 'empty.mp4', {
          maxBytes: 1024,
          allowedExtensions: ['mp4'],
        }),
      (error: unknown) =>
        error instanceof VideoValidationError &&
        error.message.includes('empty'),
    );

    await rm(dir, { recursive: true, force: true });
  });

  it('accepts a small mp4-named file within limits', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'context-hub-video-'));
    const filePath = join(dir, 'clip.mp4');
    await writeFile(filePath, Buffer.alloc(64, 1));

    const result = await assertVideoFile(filePath, 'clip.mp4', {
      maxBytes: 1024,
      allowedExtensions: ['mp4'],
    });

    assert.equal(result.extension, 'mp4');
    assert.equal(result.sizeBytes, 64);

    await rm(dir, { recursive: true, force: true });
  });
});

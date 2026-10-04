import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  isGeminiFileRefReusable,
  readGeminiFileRef,
  writeGeminiFileRef,
} from './file-ref';

describe('gemini file-ref cache', () => {
  it('reuses a reference when hash matches and expiry is in the future', () => {
    const ref = {
      fileName: 'files/abc',
      fileUri: 'https://example.test/files/abc',
      mimeType: 'video/mp4',
      contentSha256: 'deadbeef',
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    };
    assert.equal(isGeminiFileRefReusable(ref, 'deadbeef'), true);
    assert.equal(isGeminiFileRefReusable(ref, 'other'), false);
  });

  it('persists and reads the reference from storage', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ctx-hub-file-ref-'));
    try {
      const ref = {
        fileName: 'files/xyz',
        fileUri: 'https://example.test/files/xyz',
        mimeType: 'video/mp4',
        contentSha256: 'abc123',
        expiresAt: null,
      };
      await writeGeminiFileRef(root, 'source-1', ref);
      const loaded = await readGeminiFileRef(root, 'source-1');
      assert.deepEqual(loaded, ref);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

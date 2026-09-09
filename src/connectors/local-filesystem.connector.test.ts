import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { LocalFilesystemVideoConnector } from './local-filesystem.connector';

const noopLogger = {
  info() {},
  error() {},
  warn() {},
  debug() {},
  child() {
    return this;
  },
} as never;

describe('LocalFilesystemVideoConnector', () => {
  it('collects a local video path with checkpoint/version', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ctx-fs-'));
    const path = join(dir, 'lesson.mp4');
    await writeFile(path, Buffer.alloc(64));

    const connector = new LocalFilesystemVideoConnector();
    const [item] = await connector.collect({ path }, { logger: noopLogger });

    assert.ok(item);
    assert.equal(item.connectorKind, 'local-filesystem');
    assert.equal(item.originalName, 'lesson.mp4');
    assert.equal(item.ephemeral, false);
    assert.equal(item.checkpoint, path);
    assert.ok(item.version);
    assert.equal(connector.supports({ path }), true);
    assert.equal(connector.supports({ filename: 'x.mp4' }), false);
  });

  it('rejects missing files', async () => {
    const connector = new LocalFilesystemVideoConnector();
    await assert.rejects(
      () =>
        connector.collect(
          { path: join(tmpdir(), 'missing-lesson.mp4') },
          { logger: noopLogger },
        ),
      /File not found/,
    );
  });
});

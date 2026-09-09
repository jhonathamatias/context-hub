import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const baseUrl = process.env.CONTEXT_HUB_BASE_URL ?? 'http://127.0.0.1:3000';

async function tryFetch(path: string, init?: RequestInit) {
  try {
    return await fetch(`${baseUrl}${path}`, init);
  } catch {
    return null;
  }
}

describe('HTTP API integration (running server)', () => {
  it('exercises health, sources list, chat validation, and docs', async () => {
    const health = await tryFetch('/health');
    if (!health) {
      // Server not up in this environment — skip without failing local unit runs.
      return;
    }

    assert.equal(health.status === 200 || health.status === 503, true);
    const healthBody = (await health.json()) as { status: string };
    assert.ok(healthBody.status === 'ok' || healthBody.status === 'degraded');

    const sources = await tryFetch('/sources?page=1&pageSize=5');
    assert.ok(sources);
    assert.equal(sources.status, 200);
    const listBody = (await sources.json()) as {
      items: unknown[];
      page: number;
      pageSize: number;
      total: number;
    };
    assert.equal(listBody.page, 1);
    assert.equal(listBody.pageSize, 5);
    assert.ok(Array.isArray(listBody.items));
    assert.equal(typeof listBody.total, 'number');

    const badChat = await tryFetch('/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question: '' }),
    });
    assert.ok(badChat);
    assert.equal(badChat.status, 400);
    const errBody = (await badChat.json()) as {
      statusCode: number;
      message: string;
      requestId: string;
    };
    assert.equal(errBody.statusCode, 400);
    assert.ok(errBody.requestId);

    const missing = await tryFetch(
      '/sources/512b014f-7c61-4e49-9511-970aecdea526',
    );
    assert.ok(missing);
    assert.ok(missing.status === 404 || missing.status === 200);

    const docs = await tryFetch('/docs/json');
    assert.ok(docs);
    assert.equal(docs.status, 200);
    const openapi = (await docs.json()) as {
      openapi?: string;
      paths?: Record<string, unknown>;
    };
    assert.ok(openapi.paths?.['/health']);
    assert.ok(openapi.paths?.['/sources']);
    assert.ok(openapi.paths?.['/chat']);
    assert.ok(openapi.paths?.['/sources/videos']);
  });
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseLlmJsonObject } from './parse-llm-json';

describe('parseLlmJsonObject', () => {
  it('parses plain JSON objects', () => {
    assert.deepEqual(parseLlmJsonObject('{"a":1}'), { a: 1 });
  });

  it('strips markdown fences', () => {
    assert.deepEqual(parseLlmJsonObject('```json\n{"a":1}\n```'), { a: 1 });
  });

  it('extracts the first balanced object from noisy text', () => {
    assert.deepEqual(parseLlmJsonObject('Here you go:\n{"ok":true}\nthanks'), {
      ok: true,
    });
  });

  it('rejects truncated JSON', () => {
    assert.throws(() => parseLlmJsonObject('{"summary":"unterminated'), /Failed to parse/);
  });
});

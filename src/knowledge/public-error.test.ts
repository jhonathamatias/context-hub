import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  KNOWLEDGE_SOFT_FAIL_USER_MESSAGE,
  toPublicKnowledgeErrorMessage,
} from './public-error';

describe('toPublicKnowledgeErrorMessage', () => {
  it('hides quota / fallback / provider internals', () => {
    const msg = toPublicKnowledgeErrorMessage(
      'Fallback (ollama) failed after gemini 429 quota exceeded',
    );
    assert.equal(msg, KNOWLEDGE_SOFT_FAIL_USER_MESSAGE);
  });

  it('keeps short non-provider messages', () => {
    const msg = toPublicKnowledgeErrorMessage('Resumo incompleto no schema');
    assert.equal(msg, 'Resumo incompleto no schema');
  });
});

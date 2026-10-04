import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  multimodalPrimaryAttempts,
  multimodalTotalAttempts,
  resolveMultimodalModel,
  willRetryMultimodalAttempt,
  type MultimodalAttemptConfig,
} from './multimodal-attempts';

const primaryOnly: MultimodalAttemptConfig = {
  primaryModel: 'gemini-primary',
  primaryAttempts: 4,
  retryDelayMs: 5_000,
};

const withFallback: MultimodalAttemptConfig = {
  ...primaryOnly,
  fallbackModel: 'gemini-fallback',
};

describe('multimodal attempts / model selection', () => {
  it('uses primary model for attempts within max primary attempts', () => {
    assert.equal(multimodalPrimaryAttempts(primaryOnly), 4);
    assert.equal(multimodalTotalAttempts(primaryOnly), 4);
    const resolved = resolveMultimodalModel(1, primaryOnly);
    assert.equal(resolved.model, 'gemini-primary');
    assert.equal(resolved.isFallback, false);
  });

  it('only switches to fallback after primary attempts when configured', () => {
    assert.equal(multimodalTotalAttempts(withFallback), 5);
    assert.equal(resolveMultimodalModel(4, withFallback).isFallback, false);
    const last = resolveMultimodalModel(5, withFallback);
    assert.equal(last.model, 'gemini-fallback');
    assert.equal(last.isFallback, true);
  });

  it('willRetry is true only before the last attempt', () => {
    assert.equal(willRetryMultimodalAttempt(1, 4), true);
    assert.equal(willRetryMultimodalAttempt(4, 4), false);
  });
});

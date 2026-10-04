import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MediaProcessing, PartMediaResolutionLevel } from '@google/genai';
import {
  resolveGeminiVideoMediaResolution,
  resolveGeminiVideoProcessingMode,
  toMediaProcessing,
  toPartMediaResolutionLevel,
} from './gemini-video-config';

describe('gemini video config', () => {
  it('accepts static|agentic processing modes', () => {
    assert.equal(resolveGeminiVideoProcessingMode('static'), 'static');
    assert.equal(resolveGeminiVideoProcessingMode('agentic'), 'agentic');
    assert.equal(toMediaProcessing('static'), MediaProcessing.STATIC);
    assert.equal(toMediaProcessing('agentic'), MediaProcessing.AGENTIC);
  });

  it('accepts media resolution values and omits default', () => {
    assert.equal(resolveGeminiVideoMediaResolution('low'), 'low');
    assert.equal(
      toPartMediaResolutionLevel('low'),
      PartMediaResolutionLevel.MEDIA_RESOLUTION_LOW,
    );
    assert.equal(toPartMediaResolutionLevel('default'), null);
  });

  it('fails clearly on invalid configuration', () => {
    assert.throws(
      () => resolveGeminiVideoProcessingMode('turbo'),
      /GEMINI_VIDEO_PROCESSING_MODE/,
    );
    assert.throws(
      () => resolveGeminiVideoMediaResolution('ultra'),
      /GEMINI_VIDEO_MEDIA_RESOLUTION/,
    );
  });
});

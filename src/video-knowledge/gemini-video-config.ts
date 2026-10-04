import {
  MediaProcessing,
  PartMediaResolutionLevel,
} from '@google/genai';

export type GeminiVideoProcessingMode = 'static' | 'agentic';
export type GeminiVideoMediaResolution = 'default' | 'low' | 'medium' | 'high';

export function resolveGeminiVideoProcessingMode(
  value: string,
): GeminiVideoProcessingMode {
  if (value === 'static' || value === 'agentic') return value;
  throw new Error(
    `Invalid GEMINI_VIDEO_PROCESSING_MODE="${value}". Use static|agentic.`,
  );
}

export function resolveGeminiVideoMediaResolution(
  value: string,
): GeminiVideoMediaResolution {
  if (
    value === 'default' ||
    value === 'low' ||
    value === 'medium' ||
    value === 'high'
  ) {
    return value;
  }
  throw new Error(
    `Invalid GEMINI_VIDEO_MEDIA_RESOLUTION="${value}". Use default|low|medium|high.`,
  );
}

/** Maps env mode → SDK MediaProcessing (adapter-only). */
export function toMediaProcessing(
  mode: GeminiVideoProcessingMode,
): MediaProcessing {
  return mode === 'agentic' ? MediaProcessing.AGENTIC : MediaProcessing.STATIC;
}

/** Maps env resolution → part-level SDK enum; null means omit (model default). */
export function toPartMediaResolutionLevel(
  resolution: GeminiVideoMediaResolution,
): PartMediaResolutionLevel | null {
  switch (resolution) {
    case 'low':
      return PartMediaResolutionLevel.MEDIA_RESOLUTION_LOW;
    case 'medium':
      return PartMediaResolutionLevel.MEDIA_RESOLUTION_MEDIUM;
    case 'high':
      return PartMediaResolutionLevel.MEDIA_RESOLUTION_HIGH;
    case 'default':
      return null;
  }
}

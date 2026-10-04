import { env } from '../config/env';

export type MultimodalAttemptConfig = {
  primaryModel: string;
  primaryAttempts: number;
  fallbackModel?: string;
  retryDelayMs: number;
};

export function readMultimodalAttemptConfig(
  gemini: {
    videoModel: string;
    videoMaxAttempts: number;
    videoRetryDelayMs: number;
    videoFallbackModel?: string;
  } = env.gemini,
): MultimodalAttemptConfig {
  return {
    primaryModel: gemini.videoModel,
    primaryAttempts: gemini.videoMaxAttempts,
    retryDelayMs: gemini.videoRetryDelayMs,
    ...(gemini.videoFallbackModel
      ? { fallbackModel: gemini.videoFallbackModel }
      : {}),
  };
}

/** Primary-model BullMQ attempts (fallback is an extra attempt when configured). */
export function multimodalPrimaryAttempts(
  config: MultimodalAttemptConfig = readMultimodalAttemptConfig(),
): number {
  return config.primaryAttempts;
}

/** Total BullMQ attempts: primary + optional one fallback model attempt. */
export function multimodalTotalAttempts(
  config: MultimodalAttemptConfig = readMultimodalAttemptConfig(),
): number {
  return config.fallbackModel
    ? config.primaryAttempts + 1
    : config.primaryAttempts;
}

export function resolveMultimodalModel(
  attempt: number,
  config: MultimodalAttemptConfig = readMultimodalAttemptConfig(),
): {
  model: string;
  isFallback: boolean;
} {
  if (config.fallbackModel && attempt > config.primaryAttempts) {
    return { model: config.fallbackModel, isFallback: true };
  }
  return { model: config.primaryModel, isFallback: false };
}

export function willRetryMultimodalAttempt(
  attempt: number,
  maxAttempts: number,
): boolean {
  return attempt < maxAttempts;
}

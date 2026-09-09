import type { FastifyBaseLogger } from 'fastify';

const SENSITIVE_KEY_PATTERN =
  /(password|secret|token|authorization|api[_-]?key|cookie|content|buffer|file|payload)/i;

export type ProcessingResult = 'succeeded' | 'failed' | 'skipped';

export type ProcessingLogMeta = Record<
  string,
  string | number | boolean | null | undefined
>;

function sanitizeMeta(meta: ProcessingLogMeta = {}): ProcessingLogMeta {
  const sanitized: ProcessingLogMeta = {};

  for (const [key, value] of Object.entries(meta)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      sanitized[key] = '[Redacted]';
      continue;
    }

    sanitized[key] = value;
  }

  return sanitized;
}

/**
 * Lightweight helper for future pipeline stages (ffmpeg, whisper, embeddings...).
 * Logs duration and outcome without dumping sensitive payloads.
 */
export async function withProcessingLog<T>(
  logger: FastifyBaseLogger,
  stage: string,
  meta: ProcessingLogMeta,
  run: () => Promise<T>,
): Promise<T> {
  const startedAt = Date.now();
  const safeMeta = sanitizeMeta(meta);

  logger.info(
    {
      event: 'processing.started',
      stage,
      ...safeMeta,
    },
    `Processing stage started: ${stage}`,
  );

  try {
    const value = await run();

    logger.info(
      {
        event: 'processing.finished',
        stage,
        result: 'succeeded' satisfies ProcessingResult,
        durationMs: Date.now() - startedAt,
        ...safeMeta,
      },
      `Processing stage finished: ${stage}`,
    );

    return value;
  } catch (error) {
    logger.error(
      {
        event: 'processing.failed',
        stage,
        result: 'failed' satisfies ProcessingResult,
        durationMs: Date.now() - startedAt,
        err: error,
        ...safeMeta,
      },
      `Processing stage failed: ${stage}`,
    );

    throw error;
  }
}

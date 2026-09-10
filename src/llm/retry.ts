export type RetryOptions = {
  maxRetries: number;
  baseDelayMs?: number;
  /** Cap for exponential backoff (before jitter). */
  maxDelayMs?: number;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
};

/**
 * True for transient provider failures suitable for retry / fallback.
 * False for client/schema/app bugs (4xx other than 429, validation, etc.).
 */
export function isRetryableLlmError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as {
    status?: number;
    statusCode?: number;
    code?: string;
    message?: string;
  };

  const status = candidate.status ?? candidate.statusCode;
  if (status === 429 || (typeof status === 'number' && status >= 500)) {
    return true;
  }
  if (typeof status === 'number' && status >= 400 && status < 500) {
    return false;
  }

  const code = candidate.code?.toLowerCase();
  if (
    code === 'etimedout' ||
    code === 'econnreset' ||
    code === 'econnrefused' ||
    code === 'enotfound' ||
    code === 'eai_again'
  ) {
    return true;
  }

  const message = candidate.message?.toLowerCase() ?? '';
  if (
    message.includes('invalid schema') ||
    message.includes('schema validation') ||
    message.includes('failed schema') ||
    message.includes('invalid input') ||
    message.includes('bad request')
  ) {
    return false;
  }

  return (
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('rate limit') ||
    message.includes('quota') ||
    message.includes('resource exhausted') ||
    message.includes('temporarily unavailable') ||
    message.includes('service unavailable') ||
    message.includes('overloaded') ||
    message.includes('429')
  );
}

/** Alias used by fallback strategy (same recoverable set as retry). */
export function isFallbackEligibleError(error: unknown): boolean {
  return isRetryableLlmError(error);
}

export function getRetryAfterMs(error: unknown): number | null {
  if (!error || typeof error !== 'object') {
    return null;
  }

  const candidate = error as {
    headers?: Headers | Record<string, string | string[] | undefined>;
    response?: {
      headers?: Headers | Record<string, string | string[] | undefined>;
    };
  };

  const headers = candidate.headers ?? candidate.response?.headers;
  if (!headers) {
    return null;
  }

  let raw: string | null = null;
  if (typeof (headers as Headers).get === 'function') {
    raw = (headers as Headers).get('retry-after');
  } else {
    const record = headers as Record<string, string | string[] | undefined>;
    const value = record['retry-after'] ?? record['Retry-After'];
    raw = Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
  }

  if (!raw) {
    return null;
  }

  const asNumber = Number(raw);
  if (Number.isFinite(asNumber) && asNumber >= 0) {
    return Math.min(asNumber * 1000, 120_000);
  }

  const asDate = Date.parse(raw);
  if (Number.isFinite(asDate)) {
    return Math.min(Math.max(0, asDate - Date.now()), 120_000);
  }

  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withJitter(delayMs: number): number {
  const jitter = Math.floor(Math.random() * Math.max(1, delayMs * 0.25));
  return delayMs + jitter;
}

export async function withControlledRetries<T>(
  run: (attempt: number) => Promise<T>,
  options: RetryOptions,
): Promise<{ value: T; attempts: number }> {
  const maxRetries = Math.max(0, options.maxRetries);
  const baseDelayMs = options.baseDelayMs ?? 1_000;
  const maxDelayMs = options.maxDelayMs ?? 30_000;
  const shouldRetry = options.shouldRetry ?? isRetryableLlmError;

  let attempt = 0;
  while (true) {
    attempt += 1;
    try {
      const value = await run(attempt);
      return { value, attempts: attempt };
    } catch (error) {
      if (attempt >= maxRetries + 1 || !shouldRetry(error, attempt)) {
        throw error;
      }
      const retryAfter = getRetryAfterMs(error);
      const exponential = Math.min(
        maxDelayMs,
        baseDelayMs * 2 ** (attempt - 1),
      );
      const delay =
        retryAfter !== null
          ? Math.max(retryAfter, withJitter(Math.min(exponential, retryAfter)))
          : withJitter(exponential);
      await sleep(delay);
    }
  }
}

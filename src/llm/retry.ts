export type RetryOptions = {
  maxRetries: number;
  baseDelayMs?: number;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
};

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

  const code = candidate.code?.toLowerCase();
  if (
    code === 'etimedout' ||
    code === 'econnreset' ||
    code === 'econnrefused' ||
    code === 'enotfound'
  ) {
    return true;
  }

  const message = candidate.message?.toLowerCase() ?? '';
  return (
    message.includes('timeout') ||
    message.includes('rate limit') ||
    message.includes('temporarily unavailable')
  );
}

export async function withControlledRetries<T>(
  run: (attempt: number) => Promise<T>,
  options: RetryOptions,
): Promise<{ value: T; attempts: number }> {
  const maxRetries = Math.max(0, options.maxRetries);
  const baseDelayMs = options.baseDelayMs ?? 250;
  const shouldRetry = options.shouldRetry ?? isRetryableLlmError;

  let attempt = 0;
  // attempt is 1-based for metrics
  while (true) {
    attempt += 1;
    try {
      const value = await run(attempt);
      return { value, attempts: attempt };
    } catch (error) {
      if (attempt >= maxRetries + 1 || !shouldRetry(error, attempt)) {
        throw error;
      }
      const delay = baseDelayMs * 2 ** (attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

/**
 * Attach HTTP status / Retry-After onto provider SDK errors so retry + fallback
 * heuristics can see them (same shape as OllamaLlmProvider).
 */
export function normalizeProviderError(error: unknown): never {
  if (!error || typeof error !== 'object') {
    throw error;
  }

  const err = error as Error & {
    status?: number;
    statusCode?: number;
    code?: string | number;
    headers?: Headers | Record<string, string | string[] | undefined>;
    response?: {
      status?: number;
      statusCode?: number;
      headers?: Headers | Record<string, string | string[] | undefined>;
    };
    error?: {
      code?: number | string;
      status?: string;
      message?: string;
    };
  };

  const status =
    err.status ??
    err.statusCode ??
    err.response?.status ??
    err.response?.statusCode ??
    (typeof err.error?.code === 'number' ? err.error.code : undefined);

  if (typeof status === 'number' && err.status == null) {
    err.status = status;
  }

  const headers = err.headers ?? err.response?.headers;
  if (headers && err.headers == null) {
    err.headers = headers;
  }

  // Gemini often embeds 429 only in the message / nested error.status string.
  if (err.status == null) {
    const blob = `${err.message ?? ''} ${err.error?.message ?? ''} ${err.error?.status ?? ''}`;
    if (/\b429\b|RESOURCE_EXHAUSTED|rate[\s_-]?limit|quota/i.test(blob)) {
      err.status = 429;
    } else if (/\b503\b|UNAVAILABLE|temporarily unavailable/i.test(blob)) {
      err.status = 503;
    } else if (/\b500\b|INTERNAL/i.test(blob)) {
      err.status = 500;
    }
  }

  throw err;
}

export function withNormalizedProviderErrors<T>(
  run: () => Promise<T>,
): Promise<T> {
  return run().catch((error: unknown) => normalizeProviderError(error));
}

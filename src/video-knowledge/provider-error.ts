import { isRetryableLlmError } from '../llm/retry';

export type VideoErrorCategory =
  | 'rate_limit'
  | 'unavailable'
  | 'auth'
  | 'invalid_request'
  | 'invalid_schema'
  | 'not_found'
  | 'network'
  | 'unknown';

export type ClassifiedVideoError = {
  category: VideoErrorCategory;
  retryable: boolean;
  status?: number;
  /** Safe message for UI / DB — never includes stack or API keys. */
  publicMessage: string;
};

/** Shown while BullMQ will retry after 429/503. */
export const GEMINI_HIGH_DEMAND_RETRY_MESSAGE =
  'Gemini está com alta demanda. A análise será tentada novamente automaticamente.';

const GEMINI_HIGH_DEMAND_FINAL_MESSAGE =
  'Gemini está temporariamente indisponível. Tente novamente em alguns minutos.';

function readStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const candidate = error as {
    status?: number;
    statusCode?: number;
  };
  const status = candidate.status ?? candidate.statusCode;
  if (typeof status === 'number') return status;

  // @google/genai ApiError often puts a JSON blob in message: {"error":{"code":503,...}}
  const message = readMessage(error);
  try {
    const parsed = JSON.parse(message) as { error?: { code?: number } };
    if (typeof parsed?.error?.code === 'number') return parsed.error.code;
  } catch {
    // not JSON
  }
  return undefined;
}

function readMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return String(error ?? '');
}

/**
 * Classifies provider/infrastructure errors for multimodal jobs.
 * Does not import Gemini SDK types — works from status/message shape only.
 */
export function classifyVideoProviderError(
  error: unknown,
): ClassifiedVideoError {
  const status = readStatus(error);
  const message = readMessage(error);
  const lower = message.toLowerCase();

  if (
    status === 401 ||
    status === 403 ||
    /api[_ ]?key|unauthorized|permission|forbidden|authentication/i.test(
      message,
    )
  ) {
    return {
      category: 'auth',
      retryable: false,
      ...(status !== undefined ? { status } : {}),
      publicMessage: 'Falha de autenticação com o provedor de IA.',
    };
  }

  if (
    status === 404 ||
    /source not found|video file not found|not found for source/i.test(message)
  ) {
    return {
      category: 'not_found',
      retryable: false,
      ...(status !== undefined ? { status } : {}),
      publicMessage: 'Arquivo de vídeo ou aula não encontrado.',
    };
  }

  if (
    /failed schema|invalid schema|schema validation|\bzod\b/i.test(lower) &&
    !/503|429|unavailable|rate|high demand/i.test(lower)
  ) {
    return {
      category: 'invalid_schema',
      retryable: false,
      ...(status !== undefined ? { status } : {}),
      publicMessage: 'A resposta da análise veio em formato inválido.',
    };
  }

  if (/returned empty content/i.test(lower)) {
    return {
      category: 'unavailable',
      retryable: true,
      ...(status !== undefined ? { status } : {}),
      publicMessage: GEMINI_HIGH_DEMAND_RETRY_MESSAGE,
    };
  }

  if (
    status === 400 ||
    status === 413 ||
    /invalid[_ ]?(request|argument|file)|unsupported|bad request|mime/i.test(
      lower,
    )
  ) {
    return {
      category: 'invalid_request',
      retryable: false,
      ...(status !== undefined ? { status } : {}),
      publicMessage: 'Não foi possível analisar este vídeo.',
    };
  }

  // Prefer HTTP status when present — Gemini often labels 503 as "high demand".
  if (status === 503 || (typeof status === 'number' && status >= 500)) {
    return {
      category: 'unavailable',
      retryable: true,
      status,
      publicMessage: GEMINI_HIGH_DEMAND_RETRY_MESSAGE,
    };
  }

  if (status === 429) {
    return {
      category: 'rate_limit',
      retryable: true,
      status: 429,
      publicMessage: GEMINI_HIGH_DEMAND_RETRY_MESSAGE,
    };
  }

  if (/resource_exhausted|rate[\s_-]?limit|quota|high demand/i.test(lower)) {
    return {
      category: 'rate_limit',
      retryable: true,
      status: 429,
      publicMessage: GEMINI_HIGH_DEMAND_RETRY_MESSAGE,
    };
  }

  if (
    /service unavailable|temporarily unavailable|overloaded|unavailab/i.test(
      lower,
    )
  ) {
    return {
      category: 'unavailable',
      retryable: true,
      status: 503,
      publicMessage: GEMINI_HIGH_DEMAND_RETRY_MESSAGE,
    };
  }

  if (isRetryableLlmError(error)) {
    const network =
      /econnreset|etimedout|enotfound|econnrefused|network|socket/i.test(lower);
    return {
      category: network ? 'network' : 'unavailable',
      retryable: true,
      ...(status !== undefined ? { status } : {}),
      publicMessage: GEMINI_HIGH_DEMAND_RETRY_MESSAGE,
    };
  }

  return {
    category: 'unknown',
    retryable: false,
    ...(status !== undefined ? { status } : {}),
    publicMessage: 'Não foi possível concluir a análise do vídeo.',
  };
}

export function publicMessageForAttempt(
  classified: ClassifiedVideoError,
  willRetry: boolean,
): string {
  if (
    willRetry &&
    (classified.category === 'rate_limit' ||
      classified.category === 'unavailable' ||
      classified.category === 'network')
  ) {
    return GEMINI_HIGH_DEMAND_RETRY_MESSAGE;
  }
  if (
    !willRetry &&
    (classified.category === 'rate_limit' ||
      classified.category === 'unavailable' ||
      classified.category === 'network')
  ) {
    return GEMINI_HIGH_DEMAND_FINAL_MESSAGE;
  }
  return classified.publicMessage;
}

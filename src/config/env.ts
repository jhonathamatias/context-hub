import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

const optionalNonEmptyString = z.preprocess(
  (value) => (value === '' || value === undefined ? undefined : value),
  z.string().min(1).optional(),
);

const rawEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  NODE_LOG_LEVEL: z.string().min(1).default('info'),

  PORT: z.coerce.number().int().positive().optional(),
  NODE_PORT: z.coerce.number().int().positive().optional(),
  HOST: optionalNonEmptyString,
  NODE_HOST: optionalNonEmptyString,

  DATABASE_URL: optionalNonEmptyString,
  DB_USER: optionalNonEmptyString,
  DB_PASSWORD: z.string().optional(),
  DB_HOST: optionalNonEmptyString,
  DB_PORT: z.coerce.number().int().positive().optional(),
  DB_NAME: optionalNonEmptyString,

  REDIS_URL: optionalNonEmptyString,
  REDIS_HOST: optionalNonEmptyString,
  REDIS_PORT: z.coerce.number().int().positive().optional(),
  REDIS_PASSWORD: optionalNonEmptyString,

  STORAGE_DIR: z.string().min(1).default('./storage'),
  TEMP_DIR: z.string().min(1).default('./tmp'),
  MAX_UPLOAD_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(500 * 1024 * 1024),

  WHISPER_PYTHON_PATH: z.string().min(1).default('/opt/whisper-venv/bin/python'),
  WHISPER_SCRIPT_PATH: z.string().min(1).default('./python/transcribe.py'),
  WHISPER_MODEL: z.string().min(1).default('tiny'),
  WHISPER_DEVICE: z.enum(['cpu', 'cuda']).default('cpu'),
  WHISPER_TIMEOUT_MS: z.coerce.number().int().positive().default(300_000),

  OPENAI_API_KEY: optionalNonEmptyString,
  OPENAI_BASE_URL: optionalNonEmptyString,
  OPENAI_MODEL: optionalNonEmptyString,

  GEMINI_API_KEY: optionalNonEmptyString,
  GEMINI_MODEL: z.string().min(1).default('gemini-3.6-flash'),

  /** Central chat LLM used by knowledge extraction + answer generation. */
  LLM_PROVIDER: z.enum(['openai', 'gemini']).optional(),
  LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),
  LLM_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
  LLM_MAX_OUTPUT_TOKENS: z.coerce.number().int().positive().default(4096),

  KNOWLEDGE_PROVIDER: z.enum(['openai', 'gemini']).default('openai'),

  EMBEDDING_PROVIDER: z.enum(['openai', 'gemini']).default('openai'),
  OPENAI_EMBEDDING_MODEL: z
    .string()
    .min(1)
    .default('text-embedding-3-small'),
  GEMINI_EMBEDDING_MODEL: z
    .string()
    .min(1)
    .default('gemini-embedding-001'),
  EMBEDDING_DIMENSION: z.coerce.number().int().positive().optional(),
  EMBEDDING_BATCH_SIZE: z.coerce.number().int().positive().default(32),
});

export type AppEnv = {
  nodeEnv: 'development' | 'test' | 'production';
  logLevel: string;
  port: number;
  host: string;
  databaseUrl: string;
  redisUrl: string;
  storageDir: string;
  tempDir: string;
  maxUploadBytes: number;
  whisper: {
    pythonPath: string;
    scriptPath: string;
    model: string;
    device: 'cpu' | 'cuda';
    timeoutMs: number;
  };
  openai: {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
  };
  gemini: {
    apiKey?: string;
    model: string;
  };
  llm: {
    provider: 'openai' | 'gemini';
    timeoutMs: number;
    maxRetries: number;
    maxOutputTokens: number;
  };
  knowledgeProvider: 'openai' | 'gemini';
  embedding: {
    provider: 'openai' | 'gemini';
    openaiModel: string;
    geminiModel: string;
    dimension?: number;
    batchSize: number;
  };
};

function buildDatabaseUrl(raw: z.infer<typeof rawEnvSchema>): string {
  if (raw.DATABASE_URL) {
    return raw.DATABASE_URL;
  }

  const user = raw.DB_USER;
  const password = raw.DB_PASSWORD;
  const host = raw.DB_HOST;
  const port = raw.DB_PORT;
  const name = raw.DB_NAME;

  if (!user || password === undefined || !host || !port || !name) {
    throw new Error(
      'DATABASE_URL is missing. Provide DATABASE_URL or DB_USER, DB_PASSWORD, DB_HOST, DB_PORT and DB_NAME.',
    );
  }

  return `postgresql://${user}:${encodeURIComponent(password)}@${host}:${port}/${name}`;
}

function buildRedisUrl(raw: z.infer<typeof rawEnvSchema>): string {
  if (raw.REDIS_URL) {
    return raw.REDIS_URL;
  }

  const host = raw.REDIS_HOST;
  const port = raw.REDIS_PORT;

  if (!host || !port) {
    throw new Error(
      'REDIS_URL is missing. Provide REDIS_URL or REDIS_HOST and REDIS_PORT.',
    );
  }

  if (raw.REDIS_PASSWORD) {
    return `redis://:${encodeURIComponent(raw.REDIS_PASSWORD)}@${host}:${port}`;
  }

  return `redis://${host}:${port}`;
}

function formatEnvError(error: z.ZodError): string {
  const details = error.issues
    .map((issue) => `- ${issue.path.join('.') || 'env'}: ${issue.message}`)
    .join('\n');

  return `Invalid environment configuration:\n${details}`;
}

function ensureRuntimeDirs(storageDir: string, tempDir: string): void {
  mkdirSync(storageDir, { recursive: true });
  mkdirSync(tempDir, { recursive: true });
}

export function loadEnv(
  source: Record<string, string | undefined> = process.env,
): AppEnv {
  const parsed = rawEnvSchema.safeParse(source);

  if (!parsed.success) {
    throw new Error(formatEnvError(parsed.error));
  }

  const raw = parsed.data;
  const port = raw.PORT ?? raw.NODE_PORT;
  const host = raw.HOST ?? raw.NODE_HOST;

  if (port === undefined) {
    throw new Error('PORT is missing. Provide PORT or NODE_PORT.');
  }

  if (!host) {
    throw new Error('HOST is missing. Provide HOST or NODE_HOST.');
  }

  const storageDir = resolve(raw.STORAGE_DIR);
  const tempDir = resolve(raw.TEMP_DIR);

  ensureRuntimeDirs(storageDir, tempDir);

  const openai: AppEnv['openai'] = {};
  if (raw.OPENAI_API_KEY !== undefined) {
    openai.apiKey = raw.OPENAI_API_KEY;
  }
  if (raw.OPENAI_BASE_URL !== undefined) {
    openai.baseUrl = raw.OPENAI_BASE_URL;
  }
  if (raw.OPENAI_MODEL !== undefined) {
    openai.model = raw.OPENAI_MODEL;
  } else {
    openai.model = 'gpt-4o-mini';
  }

  const gemini: AppEnv['gemini'] = {
    model: raw.GEMINI_MODEL,
  };
  if (raw.GEMINI_API_KEY !== undefined) {
    gemini.apiKey = raw.GEMINI_API_KEY;
  }

  const embedding: AppEnv['embedding'] = {
    provider: raw.EMBEDDING_PROVIDER,
    openaiModel: raw.OPENAI_EMBEDDING_MODEL,
    geminiModel: raw.GEMINI_EMBEDDING_MODEL,
    batchSize: raw.EMBEDDING_BATCH_SIZE,
  };
  if (raw.EMBEDDING_DIMENSION !== undefined) {
    embedding.dimension = raw.EMBEDDING_DIMENSION;
  }

  const llmProvider = raw.LLM_PROVIDER ?? raw.KNOWLEDGE_PROVIDER;

  return {
    nodeEnv: raw.NODE_ENV,
    logLevel: raw.NODE_LOG_LEVEL,
    port,
    host,
    databaseUrl: buildDatabaseUrl(raw),
    redisUrl: buildRedisUrl(raw),
    storageDir,
    tempDir,
    maxUploadBytes: raw.MAX_UPLOAD_BYTES,
    whisper: {
      pythonPath: raw.WHISPER_PYTHON_PATH,
      scriptPath: resolve(raw.WHISPER_SCRIPT_PATH),
      model: raw.WHISPER_MODEL,
      device: raw.WHISPER_DEVICE,
      timeoutMs: raw.WHISPER_TIMEOUT_MS,
    },
    openai,
    gemini,
    llm: {
      provider: llmProvider,
      timeoutMs: raw.LLM_TIMEOUT_MS,
      maxRetries: raw.LLM_MAX_RETRIES,
      maxOutputTokens: raw.LLM_MAX_OUTPUT_TOKENS,
    },
    knowledgeProvider: raw.KNOWLEDGE_PROVIDER,
    embedding,
  };
}

export const env = loadEnv();

import type { PinoLoggerOptions } from 'fastify/types/logger';
import { env } from '../config/env';

const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers["x-api-key"]',
  'req.headers["x-openai-key"]',
  '*.password',
  '*.apiKey',
  '*.api_key',
  '*.token',
  '*.secret',
  'openai.apiKey',
];

export function buildLoggerOptions(): PinoLoggerOptions {
  const base: PinoLoggerOptions = {
    level: env.logLevel,
    redact: {
      paths: REDACT_PATHS,
      censor: '[Redacted]',
    },
  };

  if (env.nodeEnv === 'production') {
    return base;
  }

  return {
    ...base,
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    },
  };
}

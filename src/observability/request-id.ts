import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';

export function generateRequestId(req: IncomingMessage): string {
  const header = req.headers['x-request-id'] ?? req.headers['x-correlation-id'];

  if (typeof header === 'string' && header.trim().length > 0) {
    return header.trim();
  }

  if (Array.isArray(header)) {
    const first = header.find((value) => value.trim().length > 0);
    if (first) {
      return first.trim();
    }
  }

  return randomUUID();
}

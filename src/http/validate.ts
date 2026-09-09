import type { z } from 'zod';

export class ValidationError extends Error {
  readonly statusCode = 400;
  readonly name = 'Bad Request';

  constructor(message: string) {
    super(message);
  }
}

export function parseInput<TSchema extends z.ZodType>(
  schema: TSchema,
  data: unknown,
): z.infer<TSchema> {
  const parsed = schema.safeParse(data);

  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join('.') : 'input';
        return `${path}: ${issue.message}`;
      })
      .join('; ');

    throw new ValidationError(message);
  }

  return parsed.data;
}

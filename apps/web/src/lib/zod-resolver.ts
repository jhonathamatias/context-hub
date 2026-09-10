import type {
  FieldErrors,
  FieldValues,
  Resolver,
} from 'react-hook-form';
import type { ZodType } from 'zod';

/**
 * Minimal Zod → react-hook-form resolver (avoids @hookform/resolvers install).
 */
export function zodResolver<TFieldValues extends FieldValues>(
  schema: ZodType<TFieldValues>,
): Resolver<TFieldValues> {
  return async (values) => {
    const parsed = schema.safeParse(values);
    if (parsed.success) {
      return {
        values: parsed.data,
        errors: {},
      };
    }

    const errors = {} as FieldErrors<TFieldValues>;
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? 'root') as keyof FieldErrors<TFieldValues> &
        string;
      if (errors[key]) continue;
      (errors as Record<string, { type: string; message: string }>)[key] = {
        type: issue.code,
        message: issue.message,
      };
    }

    return {
      values: {} as Record<string, never>,
      errors,
    };
  };
}

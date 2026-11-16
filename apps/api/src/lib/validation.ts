import type { z, ZodTypeAny } from 'zod';
import { AppError } from './response.js';

export function parseWithSchema<TSchema extends ZodTypeAny>(
  schema: TSchema,
  input: unknown,
): z.output<TSchema> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new AppError('Payload validasi tidak memenuhi skema', 400, 'VALIDATION_ERROR', {
      issues: result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }
  return result.data;
}

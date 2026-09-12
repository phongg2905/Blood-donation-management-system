import type { RequestHandler } from 'express';
import type { z } from 'zod';
import { AppError } from '../common/errors/app.error';
export const validate =
  <T>(
    schema: z.ZodType<T>,
    source: 'body' | 'params' | 'query' = 'body',
  ): RequestHandler =>
  (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      throw new AppError(
        'Validation failed',
        400,
        result.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      );
    }
    res.locals.validated = result.data;
    next();
  };

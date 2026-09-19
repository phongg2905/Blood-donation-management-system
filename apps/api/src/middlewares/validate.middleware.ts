import type { RequestHandler } from 'express';
import type { z } from 'zod';
import { AppError } from '../common/errors/app.error';
import { zodFields } from '../common/helpers/response';

/**
 * Validates a request part and exposes the parsed value at `res.locals.validated`.
 * Failures return VALIDATION_ERROR with a field -> message map.
 */
export const validate =
  <T>(
    schema: z.ZodType<T>,
    source: 'body' | 'params' | 'query' = 'body',
  ): RequestHandler =>
  (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      throw AppError.validation(zodFields(result.error.issues));
    }
    res.locals.validated = result.data;
    next();
  };

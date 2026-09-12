import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { ApiFailure } from '@blood/shared-types';
import { AppError } from '../common/errors/app.error';

export const notFound: RequestHandler = (_req, _res, next) =>
  next(new AppError('Route not found', 404));
export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _req,
  res,
  next,
) => {
  if (res.headersSent) {
    next(error);
    return;
  }
  const parserStatus =
    typeof error === 'object' && error !== null && 'status' in error
      ? error.status
      : undefined;
  const status =
    error instanceof AppError
      ? error.statusCode
      : parserStatus === 400
        ? 400
        : parserStatus === 413
          ? 413
          : 500;
  if (status >= 500) console.error(error);
  const body: ApiFailure = {
    success: false,
    message:
      error instanceof AppError
        ? error.message
        : status === 400
          ? 'Invalid request body'
          : status === 413
            ? 'Request body too large'
            : 'Internal server error',
    errors: error instanceof AppError ? error.errors : [],
  };
  res.status(status).json(body);
};

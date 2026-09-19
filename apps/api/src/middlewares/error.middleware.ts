import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ERROR_CODES } from '@blood/shared-types';
import { AppError } from '../common/errors/app.error';
import { failureResponse } from '../common/helpers/response';

export const notFound: RequestHandler = (_req, _res, next) =>
  next(AppError.notFound(ERROR_CODES.ROUTE_NOT_FOUND));

interface BodyParserError {
  status?: unknown;
  type?: unknown;
}

const asBodyParserError = (error: unknown): BodyParserError =>
  typeof error === 'object' && error !== null ? (error as BodyParserError) : {};

/** Maps body-parser failures (bad JSON, oversized payload) onto error codes. */
function normalize(error: unknown): AppError {
  if (error instanceof AppError) return error;
  const parser = asBodyParserError(error);
  if (parser.type === 'entity.too.large' || parser.status === 413) {
    return new AppError(ERROR_CODES.PAYLOAD_TOO_LARGE, 413);
  }
  if (parser.status === 400) {
    return new AppError(ERROR_CODES.REQUEST_INVALID, 400);
  }
  return new AppError(ERROR_CODES.INTERNAL_ERROR, 500);
}

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
  const appError = normalize(error);
  if (appError.statusCode >= 500) console.error(error);
  res
    .status(appError.statusCode)
    .json(failureResponse(appError.code, appError.message, appError.fields));
};

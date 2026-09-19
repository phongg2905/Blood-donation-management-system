import {
  ERROR_CODES,
  ERROR_MESSAGES,
  type ApiFieldErrors,
  type ErrorCode,
} from '@blood/shared-types';

/**
 * Every API failure carries a stable machine-readable `code`. The frontend
 * branches on `code`; `message` is a human-readable default in Vietnamese and
 * can be overridden per call site.
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly fields: ApiFieldErrors | null;

  constructor(
    code: ErrorCode,
    statusCode: number,
    message?: string,
    fields: ApiFieldErrors | null = null,
  ) {
    super(message ?? ERROR_MESSAGES[code]);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.fields = fields;
  }

  static validation(fields: ApiFieldErrors): AppError {
    return new AppError(ERROR_CODES.VALIDATION_ERROR, 400, undefined, fields);
  }

  static badRequest(
    code: ErrorCode,
    message?: string,
    fields: ApiFieldErrors | null = null,
  ): AppError {
    return new AppError(code, 400, message, fields);
  }

  static unauthorized(code: ErrorCode = ERROR_CODES.UNAUTHENTICATED): AppError {
    return new AppError(code, 401);
  }

  static forbidden(code: ErrorCode = ERROR_CODES.FORBIDDEN): AppError {
    return new AppError(code, 403);
  }

  static notFound(code: ErrorCode, message?: string): AppError {
    return new AppError(code, 404, message);
  }

  static conflict(
    code: ErrorCode,
    message?: string,
    fields: ApiFieldErrors | null = null,
  ): AppError {
    return new AppError(code, 409, message, fields);
  }

  static internal(message?: string): AppError {
    return new AppError(ERROR_CODES.INTERNAL_ERROR, 500, message);
  }
}

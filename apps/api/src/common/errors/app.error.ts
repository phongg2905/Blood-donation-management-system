import type { ApiErrorDetail } from '@blood/shared-types';
export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 500,
    public readonly errors: ApiErrorDetail[] = [],
  ) {
    super(message);
    this.name = 'AppError';
  }
}

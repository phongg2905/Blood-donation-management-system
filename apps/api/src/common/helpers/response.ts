import type { ApiSuccess } from '@blood/shared-types';
export const successResponse = <T>(
  message: string,
  data: T,
): ApiSuccess<T> => ({
  success: true,
  message,
  data,
});

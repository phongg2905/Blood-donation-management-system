import { z } from 'zod';
import { ERROR_CODES, type ErrorCode } from '@blood/shared-types';
import { AppError } from '../errors/app.error';
import { zodFields } from './response';

/** Parses with a Zod schema and converts failures into the API error contract. */
export function parseDomain<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success)
    throw AppError.validation(zodFields(parsed.error.issues));
  return parsed.data;
}

export const positiveInteger = z.number().int().positive().max(2147483647);
export const nonNegativeInteger = z
  .number()
  .int()
  .nonnegative()
  .max(2147483647);

export const volumeSchema = z.object({ volumeMl: positiveInteger.nullish() });

/** `startsAt` must be a real instant strictly before `endsAt`. */
export function assertTimeRange(
  startsAt: Date,
  endsAt: Date,
  code: ErrorCode = ERROR_CODES.VALIDATION_ERROR,
): void {
  if (
    !Number.isFinite(startsAt.getTime()) ||
    !Number.isFinite(endsAt.getTime()) ||
    startsAt >= endsAt
  ) {
    throw AppError.badRequest(code, undefined, {
      startsAt: 'Thời gian bắt đầu phải trước thời gian kết thúc',
    });
  }
}

// Bounds are supplied from approved application settings, not medical defaults.
export function assertMeasurement(
  value: number,
  min: number,
  max: number,
  integer = false,
  field = 'value',
): void {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) {
    throw AppError.internal('Invalid measurement limits');
  }
  if (
    !Number.isFinite(value) ||
    value <= 0 ||
    value < min ||
    value > max ||
    (integer && !Number.isInteger(value))
  ) {
    throw AppError.badRequest(ERROR_CODES.MEASUREMENT_INVALID, undefined, {
      [field]: 'Chỉ số nằm ngoài giới hạn cho phép',
    });
  }
}

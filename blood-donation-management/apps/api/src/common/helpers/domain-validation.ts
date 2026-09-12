import { z } from 'zod';
import { AppError } from '../errors/app.error';

export function parseDomain<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(
      'Validation failed',
      400,
      parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    );
  }
  return parsed.data;
}

export const positiveInteger = z.number().int().positive().max(2147483647);
export const nonNegativeInteger = z
  .number()
  .int()
  .nonnegative()
  .max(2147483647);
export const volumeSchema = z.object({ volumeMl: positiveInteger.nullish() });

export function assertTimeRange(startsAt: Date, endsAt: Date): void {
  if (
    !Number.isFinite(startsAt.getTime()) ||
    !Number.isFinite(endsAt.getTime()) ||
    startsAt >= endsAt
  ) {
    throw new AppError('startsAt must be before endsAt', 400);
  }
}

// Bounds are supplied from approved application settings, not medical defaults.
export function assertMeasurement(
  value: number,
  min: number,
  max: number,
  integer = false,
): void {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) {
    throw new AppError('Invalid measurement limits', 500);
  }
  if (
    !Number.isFinite(value) ||
    value <= 0 ||
    value < min ||
    value > max ||
    (integer && !Number.isInteger(value))
  ) {
    throw new AppError('Measurement is outside configured limits', 400);
  }
}

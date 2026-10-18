import { z } from 'zod';
import {
  ERROR_CODES,
  MEASUREMENT_UNITS,
  SCREENING_TEST_CODES,
  SCREENING_TRANSITIONS,
  isScreeningTestCode,
  type ScreeningStatus,
} from '@blood/shared-types';
import { AppError } from '../../common/errors/app.error';
import { parseDomain } from '../../common/helpers/domain-validation';
import { assertTransition } from '../../common/helpers/state-machine';

/**
 * Canonical screening units (Phase 1 data convention):
 * weightKg = kg, temperatureC = °C, systolicBp/diastolicBp = mmHg,
 * pulse = bpm, hemoglobin = g/dL.
 *
 * The numeric bounds below are structural sanity limits only — they are not
 * clinical eligibility thresholds, which belong to approved policy/settings.
 */
export const SCREENING_UNITS = MEASUREMENT_UNITS;

export const screeningMeasurementsSchema = z
  .object({
    weightKg: z.number().min(30).max(250).nullish(),
    temperatureC: z.number().min(34.0).max(43.0).nullish(),
    systolicBp: z.number().int().min(60).max(260).nullish(),
    diastolicBp: z.number().int().min(40).max(160).nullish(),
    pulse: z.number().int().min(40).max(200).nullish(),
    hemoglobin: z
      .preprocess((val) => {
        if (typeof val === 'number' && val > 0 && val <= 30) {
          return Math.round(val * 10 * 10) / 10;
        }
        return val;
      }, z.number().min(30).max(250).nullish()),
    indicatedVolumeMl: z.number().int().positive().nullish(),
  })
  .refine(
    (data) => {
      if (data.systolicBp && data.diastolicBp) {
        return data.systolicBp > data.diastolicBp;
      }
      return true;
    },
    {
      message: 'Huyết áp tâm thu phải lớn hơn huyết áp tâm trương',
      path: ['systolicBp'],
    },
  );

export const screeningTestSchema = z.object({
  code: z.string().min(1).max(64),
  result: z.string().max(200).nullish(),
  numericValue: z.number().finite().nullish(),
  unit: z.string().max(32).nullish(),
  referenceRange: z.string().max(100).nullish(),
  isPassed: z.boolean().nullish(),
  notes: z.string().max(1000).nullish(),
});

export function validateScreeningMeasurements(input: unknown) {
  return parseDomain(screeningMeasurementsSchema, input);
}

/**
 * Test codes must come from the fixed catalogue; the frontend cannot submit
 * arbitrary codes, and duplicate codes within one screening are rejected.
 */
export function validateScreeningTests(input: unknown) {
  const tests = parseDomain(z.array(screeningTestSchema).max(50), input);
  const seen = new Set<string>();
  for (const test of tests) {
    if (!isScreeningTestCode(test.code)) {
      throw AppError.badRequest(
        ERROR_CODES.SCREENING_TEST_CODE_INVALID,
        undefined,
        {
          code: `Mã xét nghiệm phải thuộc danh mục: ${SCREENING_TEST_CODES.join(', ')}`,
        },
      );
    }
    if (seen.has(test.code)) {
      throw AppError.validation({
        code: `Mã xét nghiệm bị trùng: ${test.code}`,
      });
    }
    seen.add(test.code);
  }
  return tests;
}

export const screeningReviewSchema = z.object({
  status: z.enum(['WAITING_REVIEW', 'ELIGIBLE', 'INELIGIBLE', 'DEFERRED']),
  decisionReason: z.string().trim().max(1000).nullish(),
  deferredUntil: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() ? new Date(val) : val),
    z.date().nullish(),
  ),
  indicatedVolumeMl: z.number().int().positive().nullish(),
  notes: z.string().trim().max(2000).nullish(),
});

/**
 * A DEFERRED result must always carry a reason. `deferredUntil` is optional
 * because the return date is not always known at review time.
 */
export function validateScreeningReview(input: unknown) {
  const review = parseDomain(screeningReviewSchema, input);
  if (
    review.status === 'DEFERRED' &&
    (!review.decisionReason || review.decisionReason.length === 0)
  ) {
    throw AppError.badRequest(
      ERROR_CODES.SCREENING_REVIEW_REASON_REQUIRED,
      undefined,
      { decisionReason: 'Bắt buộc ghi lý do khi tạm hoãn' },
    );
  }
  return review;
}

export function assertScreeningTransition(
  from: ScreeningStatus,
  to: ScreeningStatus,
): void {
  assertTransition(
    SCREENING_TRANSITIONS,
    from,
    to,
    ERROR_CODES.SCREENING_INVALID_TRANSITION,
  );
}

/** Screening can only happen after a valid check-in. */
export function assertCanScreen(checkInId: string | null | undefined): void {
  if (!checkInId) throw AppError.conflict(ERROR_CODES.CHECK_IN_REQUIRED);
}

/** Only an ELIGIBLE screening may proceed to a donation. */
export function assertScreeningEligibleForDonation(
  status: ScreeningStatus,
): void {
  if (status !== 'ELIGIBLE') {
    throw AppError.conflict(ERROR_CODES.SCREENING_NOT_ELIGIBLE);
  }
}

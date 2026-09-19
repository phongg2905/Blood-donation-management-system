import { z } from 'zod';
import {
  DONATION_TRANSITIONS,
  ERROR_CODES,
  type DonationStatus,
  type ScreeningStatus,
} from '@blood/shared-types';
import { AppError } from '../../common/errors/app.error';
import {
  parseDomain,
  positiveInteger,
} from '../../common/helpers/domain-validation';
import { assertTransition } from '../../common/helpers/state-machine';

export function validateDonation(input: unknown) {
  const donation = parseDomain(
    z.object({
      startedAt: z.date().nullish(),
      completedAt: z.date().nullish(),
      donatedAt: z.date().nullish(),
      volumeMl: positiveInteger.nullish(),
    }),
    input,
  );
  if (donation.completedAt && !donation.startedAt) {
    throw AppError.validation({
      startedAt: 'Bắt buộc có thời điểm bắt đầu khi đã có thời điểm kết thúc',
    });
  }
  if (
    donation.completedAt &&
    donation.startedAt &&
    donation.completedAt < donation.startedAt
  ) {
    throw AppError.badRequest(
      ERROR_CODES.DONATION_TIME_INVALID,
      'Thời điểm kết thúc phải sau thời điểm bắt đầu',
      { completedAt: 'Phải sau thời điểm bắt đầu' },
    );
  }
  if (
    donation.donatedAt &&
    (!donation.completedAt || donation.donatedAt < donation.completedAt)
  ) {
    throw AppError.badRequest(
      ERROR_CODES.DONATION_TIME_INVALID,
      'Thời điểm xác nhận hoàn thành phải sau thời điểm kết thúc',
      { donatedAt: 'Phải sau thời điểm kết thúc lấy máu' },
    );
  }
  return donation;
}

/** Completing a donation requires full timing, volume and the performing staff. */
export function validateDonationCompletion(input: unknown) {
  const donation = validateDonation(input);
  const missing: Record<string, string> = {};
  if (!donation.startedAt) missing.startedAt = 'Bắt buộc có thời điểm bắt đầu';
  if (!donation.completedAt)
    missing.completedAt = 'Bắt buộc có thời điểm kết thúc';
  if (Object.keys(missing).length > 0) throw AppError.validation(missing);
  if (!donation.volumeMl || donation.volumeMl <= 0) {
    throw AppError.badRequest(
      ERROR_CODES.DONATION_VOLUME_INVALID,
      'Thể tích máu phải lớn hơn 0',
      { volumeMl: 'Phải là số nguyên lớn hơn 0 (ml)' },
    );
  }
  return donation as {
    startedAt: Date;
    completedAt: Date;
    donatedAt?: Date | null;
    volumeMl: number;
  };
}

export function assertDonationTransition(
  from: DonationStatus,
  to: DonationStatus,
): void {
  assertTransition(
    DONATION_TRANSITIONS,
    from,
    to,
    ERROR_CODES.DONATION_INVALID_TRANSITION,
  );
}

/**
 * Donation may start only when the full chain is valid:
 * valid registration -> check-in -> screening ELIGIBLE.
 */
export function assertCanStartDonation(input: {
  checkInId: string | null | undefined;
  screeningStatus: ScreeningStatus;
}): void {
  if (!input.checkInId) throw AppError.conflict(ERROR_CODES.CHECK_IN_REQUIRED);
  if (input.screeningStatus !== 'ELIGIBLE') {
    throw AppError.conflict(ERROR_CODES.SCREENING_NOT_ELIGIBLE);
  }
}

/** Records the performing staff member; nullable in schema, required in workflow. */
export function assertDonationPerformer(
  performedById: string | null | undefined,
): void {
  if (!performedById) {
    throw AppError.validation({
      performedById: 'Bắt buộc xác định nhân viên thực hiện',
    });
  }
}

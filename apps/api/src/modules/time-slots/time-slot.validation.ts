import { z } from 'zod';
import { ERROR_CODES } from '@blood/shared-types';
import { AppError } from '../../common/errors/app.error';
import {
  assertTimeRange,
  parseDomain,
  positiveInteger,
} from '../../common/helpers/domain-validation';

export const timeSlotSchema = z.object({
  campaignId: z.string().uuid(),
  startsAt: z.date(),
  endsAt: z.date(),
  capacity: positiveInteger,
});

export function validateTimeSlot(
  input: unknown,
  campaign: { startsAt: Date; endsAt: Date },
) {
  const slot = parseDomain(timeSlotSchema, input);
  assertTimeRange(
    slot.startsAt,
    slot.endsAt,
    ERROR_CODES.TIME_SLOT_OUTSIDE_CAMPAIGN,
  );
  assertTimeRange(
    campaign.startsAt,
    campaign.endsAt,
    ERROR_CODES.CAMPAIGN_DATE_INVALID,
  );
  if (slot.startsAt < campaign.startsAt || slot.endsAt > campaign.endsAt) {
    throw AppError.badRequest(
      ERROR_CODES.TIME_SLOT_OUTSIDE_CAMPAIGN,
      'Khung giờ phải nằm trong thời gian của đợt hiến máu',
    );
  }
  return slot;
}

/**
 * Mandatory Phase 1 rule: a deactivated slot can never be scheduled or
 * rescheduled, regardless of remaining capacity.
 */
export function assertTimeSlotActive(slot: { isActive: boolean }): void {
  if (!slot.isActive) {
    throw AppError.conflict(ERROR_CODES.TIME_SLOT_INACTIVE);
  }
}

/** CANCELLED and WAITLISTED registrations are excluded from `occupied` upstream. */
export function assertTimeSlotHasCapacity(
  capacity: number,
  occupied: number,
): void {
  if (occupied >= capacity) {
    throw AppError.conflict(ERROR_CODES.TIME_SLOT_FULL);
  }
}

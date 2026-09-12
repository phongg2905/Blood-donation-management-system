import { z } from 'zod';
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
  assertTimeRange(slot.startsAt, slot.endsAt);
  assertTimeRange(campaign.startsAt, campaign.endsAt);
  if (slot.startsAt < campaign.startsAt || slot.endsAt > campaign.endsAt) {
    throw new AppError('Time slot must be within campaign dates', 400);
  }
  return slot;
}

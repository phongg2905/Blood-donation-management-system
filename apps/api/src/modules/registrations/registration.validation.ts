import { z } from 'zod';
import {
  ERROR_CODES,
  REGISTRATION_TRANSITIONS,
  type RegistrationStatus,
} from '@blood/shared-types';
import { AppError } from '../../common/errors/app.error';
import { parseDomain } from '../../common/helpers/domain-validation';
import { assertTransition } from '../../common/helpers/state-machine';

export const createRegistrationSchema = z.object({
  campaignId: z.string().uuid(),
  timeSlotId: z.string().uuid().nullish(),
});

export const scheduleRegistrationSchema = z.object({
  registrationId: z.string().uuid(),
  timeSlotId: z.string().uuid(),
});

export type ScheduleRegistrationInput = z.infer<
  typeof scheduleRegistrationSchema
>;

export const validateCreateRegistration = (input: unknown) =>
  parseDomain(createRegistrationSchema, input);

export const validateScheduleRegistration = (input: unknown) =>
  parseDomain(scheduleRegistrationSchema, input);

export function assertRegistrationTransition(
  from: RegistrationStatus,
  to: RegistrationStatus,
): void {
  assertTransition(
    REGISTRATION_TRANSITIONS,
    from,
    to,
    ERROR_CODES.REGISTRATION_INVALID_TRANSITION,
  );
}

export type ScheduleOutcome = {
  mode: 'SCHEDULE' | 'RESCHEDULE';
  status: RegistrationStatus;
};

/**
 * Scheduling is legal only before the workflow moves on:
 * - PENDING / WAITLISTED  -> becomes SCHEDULED
 * - SCHEDULED / CONFIRMED -> reschedule keeps the current status
 * Anything else (checked-in, COMPLETED, CANCELLED, NO_SHOW) is rejected.
 */
export function resolveScheduleOutcome(
  status: RegistrationStatus,
): ScheduleOutcome {
  if (status === 'PENDING' || status === 'WAITLISTED') {
    assertRegistrationTransition(status, 'SCHEDULED');
    return { mode: 'SCHEDULE', status: 'SCHEDULED' };
  }
  if (status === 'SCHEDULED' || status === 'CONFIRMED') {
    return { mode: 'RESCHEDULE', status };
  }
  throw AppError.conflict(ERROR_CODES.REGISTRATION_INVALID_TRANSITION);
}

/** Check-in is allowed only from SCHEDULED or CONFIRMED, and only once. */
export function assertCanCheckIn(
  status: RegistrationStatus,
  options: { alreadyCheckedIn?: boolean } = {},
): void {
  if (options.alreadyCheckedIn) {
    throw AppError.conflict(ERROR_CODES.REGISTRATION_ALREADY_CHECKED_IN);
  }
  if (status !== 'SCHEDULED' && status !== 'CONFIRMED') {
    throw AppError.conflict(ERROR_CODES.CHECK_IN_NOT_ALLOWED);
  }
}

/** NO_SHOW can only be recorded for a registration that was expected to attend. */
export function assertCanMarkNoShow(status: RegistrationStatus): void {
  if (status !== 'SCHEDULED' && status !== 'CONFIRMED') {
    throw AppError.conflict(ERROR_CODES.REGISTRATION_INVALID_TRANSITION);
  }
}

/**
 * A donor has at most one registration per campaign. A CANCELLED registration
 * is reused (updated in place) instead of creating a second row.
 */
export function assertSingleRegistrationPerCampaign(
  existing: { id: string; status: RegistrationStatus } | null,
): { reuse: boolean } {
  if (!existing) return { reuse: false };
  if (existing.status === 'CANCELLED') return { reuse: true };
  throw AppError.conflict(ERROR_CODES.REGISTRATION_DUPLICATE);
}

export interface ScheduleWindow {
  startsAt: Date;
  endsAt: Date;
}

/** Half-open interval overlap: a donor cannot hold two overlapping schedules. */
export function assertNoScheduleOverlap(
  existingWindows: readonly ScheduleWindow[],
  target: ScheduleWindow,
): void {
  for (const window of existingWindows) {
    if (window.startsAt < target.endsAt && window.endsAt > target.startsAt) {
      throw AppError.conflict(
        ERROR_CODES.REGISTRATION_OVERLAP,
        'Bạn đã có lịch trùng thời gian này',
        { timeSlotId: 'Trùng thời gian với một khung giờ khác đã đăng ký' },
      );
    }
  }
}

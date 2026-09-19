import { z } from 'zod';
import {
  CAMPAIGN_STATUSES,
  CAMPAIGN_STATUSES_ACCEPTING_REGISTRATION,
  CAMPAIGN_STATUSES_FROZEN,
  CAMPAIGN_TRANSITIONS,
  ERROR_CODES,
  type CampaignStatus,
} from '@blood/shared-types';
import { AppError } from '../../common/errors/app.error';
import {
  assertTimeRange,
  parseDomain,
} from '../../common/helpers/domain-validation';
import { assertTransition } from '../../common/helpers/state-machine';

/** Integers only; positivity is asserted below so the error code stays specific. */
const targetSchema = z.number().int().max(2147483647).nullish();

const campaignSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  location: z.string().trim().min(1).max(500).optional(),
  startsAt: z.date(),
  endsAt: z.date(),
  registrationOpensAt: z.date().nullish(),
  registrationClosesAt: z.date().nullish(),
  targetDonors: targetSchema,
  targetBloodVolumeMl: targetSchema,
});

export type CampaignInput = ReturnType<typeof validateCampaign>;

/**
 * Campaign date/target rules:
 * - startsAt < endsAt
 * - registrationOpensAt < registrationClosesAt
 * - registrationClosesAt <= startsAt
 * - registrationOpensAt < startsAt
 * - targetDonors > 0 and targetBloodVolumeMl > 0 when provided
 */
export function validateCampaign(input: unknown) {
  const campaign = parseDomain(campaignSchema, input);
  assertTimeRange(
    campaign.startsAt,
    campaign.endsAt,
    ERROR_CODES.CAMPAIGN_DATE_INVALID,
  );

  const opensAt = campaign.registrationOpensAt ?? null;
  const closesAt = campaign.registrationClosesAt ?? null;

  if (opensAt && closesAt) {
    assertTimeRange(opensAt, closesAt, ERROR_CODES.CAMPAIGN_DATE_INVALID);
  }
  if (closesAt && closesAt > campaign.startsAt) {
    throw AppError.badRequest(
      ERROR_CODES.CAMPAIGN_DATE_INVALID,
      'Thời gian đóng đăng ký phải không sau thời gian bắt đầu',
      {
        registrationClosesAt: 'Phải trước hoặc bằng thời gian bắt đầu đợt hiến',
      },
    );
  }
  if (opensAt && opensAt >= campaign.startsAt) {
    throw AppError.badRequest(
      ERROR_CODES.CAMPAIGN_DATE_INVALID,
      'Thời gian mở đăng ký phải trước thời gian bắt đầu đợt hiến',
      { registrationOpensAt: 'Phải trước thời gian bắt đầu đợt hiến' },
    );
  }

  assertPositiveTarget(
    campaign.targetDonors,
    'targetDonors',
    'Chỉ tiêu số người hiến',
  );
  assertPositiveTarget(
    campaign.targetBloodVolumeMl,
    'targetBloodVolumeMl',
    'Chỉ tiêu thể tích máu',
  );

  return campaign;
}

function assertPositiveTarget(
  value: number | null | undefined,
  field: string,
  label: string,
): void {
  if (value === null || value === undefined) return;
  if (!Number.isInteger(value) || value <= 0) {
    throw AppError.badRequest(
      ERROR_CODES.CAMPAIGN_TARGET_INVALID,
      `${label} phải lớn hơn 0`,
      { [field]: 'Phải là số nguyên lớn hơn 0' },
    );
  }
}

export function assertCampaignTransition(
  from: CampaignStatus,
  to: CampaignStatus,
): void {
  assertTransition(
    CAMPAIGN_TRANSITIONS,
    from,
    to,
    ERROR_CODES.CAMPAIGN_INVALID_TRANSITION,
  );
}

/** Only OPEN campaigns accept new registrations; CANCELLED never does. */
export function assertCampaignAcceptsRegistration(
  status: CampaignStatus,
): void {
  if (!CAMPAIGN_STATUSES_ACCEPTING_REGISTRATION.includes(status)) {
    throw AppError.conflict(
      status === 'CANCELLED' || status === 'CLOSED' || status === 'COMPLETED'
        ? ERROR_CODES.REGISTRATION_CLOSED
        : ERROR_CODES.CAMPAIGN_NOT_OPEN,
    );
  }
}

/** A COMPLETED campaign freezes its business fields. */
export function assertCampaignEditable(status: CampaignStatus): void {
  if (CAMPAIGN_STATUSES_FROZEN.includes(status)) {
    throw AppError.conflict(ERROR_CODES.CAMPAIGN_NOT_EDITABLE);
  }
}

export interface RegistrationWindow {
  registrationOpensAt: Date | null;
  registrationClosesAt: Date | null;
}

/** The registration window is inclusive of opensAt and exclusive of closesAt. */
export function assertRegistrationWindowOpen(
  campaign: RegistrationWindow,
  now: Date = new Date(),
): void {
  if (campaign.registrationOpensAt && now < campaign.registrationOpensAt) {
    throw AppError.conflict(ERROR_CODES.REGISTRATION_WINDOW_CLOSED);
  }
  if (campaign.registrationClosesAt && now >= campaign.registrationClosesAt) {
    throw AppError.conflict(ERROR_CODES.REGISTRATION_WINDOW_CLOSED);
  }
}

export const isCampaignStatus = (value: string): value is CampaignStatus =>
  (CAMPAIGN_STATUSES as readonly string[]).includes(value);

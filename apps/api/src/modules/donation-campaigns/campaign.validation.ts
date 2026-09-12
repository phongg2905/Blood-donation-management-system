import { z } from 'zod';
import {
  assertTimeRange,
  nonNegativeInteger,
  parseDomain,
} from '../../common/helpers/domain-validation';
import { AppError } from '../../common/errors/app.error';

const campaignSchema = z.object({
  startsAt: z.date(),
  endsAt: z.date(),
  registrationOpensAt: z.date().nullish(),
  registrationClosesAt: z.date().nullish(),
  targetDonors: nonNegativeInteger.nullish(),
  targetBloodVolumeMl: nonNegativeInteger.nullish(),
});

export function validateCampaign(input: unknown) {
  const campaign = parseDomain(campaignSchema, input);
  assertTimeRange(campaign.startsAt, campaign.endsAt);
  if (campaign.registrationOpensAt && campaign.registrationClosesAt) {
    assertTimeRange(
      campaign.registrationOpensAt,
      campaign.registrationClosesAt,
    );
  }
  for (const date of [
    campaign.registrationOpensAt,
    campaign.registrationClosesAt,
  ]) {
    if (date && date > campaign.endsAt) {
      throw new AppError(
        'Registration window cannot extend beyond campaign end',
        400,
      );
    }
  }
  return campaign;
}

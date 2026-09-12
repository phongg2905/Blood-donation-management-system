import { z } from 'zod';
import { AppError } from '../../common/errors/app.error';
import {
  parseDomain,
  positiveInteger,
} from '../../common/helpers/domain-validation';

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
  if (
    donation.completedAt &&
    (!donation.startedAt || donation.completedAt < donation.startedAt)
  ) {
    throw new AppError('Collection end must follow collection start', 400);
  }
  if (
    donation.donatedAt &&
    (!donation.completedAt || donation.donatedAt < donation.completedAt)
  ) {
    throw new AppError(
      'Completion confirmation must follow collection end',
      400,
    );
  }
  return donation;
}

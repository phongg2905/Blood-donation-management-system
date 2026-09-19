import {
  BLOOD_BAG_TRANSITIONS,
  ERROR_CODES,
  type BloodBagStatus,
} from '@blood/shared-types';
import { AppError } from '../../common/errors/app.error';
import { assertTransition } from '../../common/helpers/state-machine';

export function assertBloodBagTransition(
  from: BloodBagStatus,
  to: BloodBagStatus,
): void {
  assertTransition(
    BLOOD_BAG_TRANSITIONS,
    from,
    to,
    ERROR_CODES.BLOOD_BAG_INVALID_TRANSITION,
  );
}

/**
 * Volume reconciliation rule. All volumes are millilitres.
 *
 * The model is one Donation to many BloodBags, so the sum of the bags must
 * equal Donation.volumeMl. In the degenerate one-bag case this reduces to
 * "bag volume === donation volume".
 */
export function assertBagVolumesReconcile(
  donationVolumeMl: number | null | undefined,
  bagVolumesMl: readonly (number | null | undefined)[],
): void {
  if (bagVolumesMl.length === 0) {
    throw AppError.badRequest(
      ERROR_CODES.DONATION_RECONCILIATION_FAILED,
      'Lượt hiến máu phải có ít nhất một túi máu',
      { donationId: 'Chưa có túi máu nào được ghi nhận' },
    );
  }
  if (!donationVolumeMl || donationVolumeMl <= 0) {
    throw AppError.badRequest(ERROR_CODES.DONATION_VOLUME_INVALID, undefined, {
      volumeMl: 'Thể tích lượt hiến phải lớn hơn 0',
    });
  }
  const invalidIndex = bagVolumesMl.findIndex(
    (volume) => !volume || !Number.isInteger(volume) || volume <= 0,
  );
  if (invalidIndex >= 0) {
    throw AppError.badRequest(
      ERROR_CODES.DONATION_RECONCILIATION_FAILED,
      'Thể tích từng túi máu phải là số nguyên dương (ml)',
      { [`bagVolumesMl.${invalidIndex}`]: 'Thể tích túi không hợp lệ' },
    );
  }
  const total = bagVolumesMl.reduce<number>(
    (sum, volume) => sum + (volume ?? 0),
    0,
  );
  if (total !== donationVolumeMl) {
    throw AppError.badRequest(
      ERROR_CODES.DONATION_RECONCILIATION_FAILED,
      `Tổng thể tích các túi (${total} ml) không khớp với lượt hiến (${donationVolumeMl} ml)`,
      { bagVolumesMl: 'Tổng thể tích túi phải bằng thể tích lượt hiến' },
    );
  }
}

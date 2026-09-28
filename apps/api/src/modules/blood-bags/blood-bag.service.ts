import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  ERROR_CODES,
} from '@blood/shared-types';
import { AppError } from '../../common/errors/app.error';
import { parseDomain } from '../../common/helpers/domain-validation';
import type { AuditContext } from '../audit-logs/audit.service';
import { auditLogService } from '../audit-logs/audit.service';
import { notificationService } from '../notifications/notification.service';
import { assertScreeningEligibleForDonation } from '../screenings/screening.validation';
import { assertBagVolumesReconcile } from './blood-bag.validation';
import { bloodBagRepository as repo } from './blood-bag.repository';

const bagSchema = z.object({
  code: z.string().trim().min(1).max(64),
  volumeMl: z.number().int().positive(),
  bloodType: z
    .enum([
      'A_POSITIVE',
      'A_NEGATIVE',
      'B_POSITIVE',
      'B_NEGATIVE',
      'AB_POSITIVE',
      'AB_NEGATIVE',
      'O_POSITIVE',
      'O_NEGATIVE',
    ])
    .nullish(),
});
const recordSchema = z.object({ bags: z.array(bagSchema).min(1).max(20) });

function generateCertificateCode(): string {
  return `CERT-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`;
}

export const bloodBagService = {
  /**
   * Choice B: the "lấy máu" step is not exposed — Donation is created and
   * marked COMPLETED silently in the same call that records barcodes, so the
   * schema's three-timestamp design stays intact without a separate HTTP flow.
   */
  async recordCollection(
    screeningId: string,
    input: unknown,
    staffUserId: string,
    ctx: AuditContext,
  ) {
    const { bags } = parseDomain(recordSchema, input);
    const totalVolumeMl = bags.reduce((sum, b) => sum + b.volumeMl, 0);
    assertBagVolumesReconcile(
      totalVolumeMl,
      bags.map((b) => b.volumeMl),
    );

    const result = await repo.transaction(async (tx) => {
      const screening = await repo.findScreeningTx(tx, screeningId);
      if (!screening) throw AppError.notFound(ERROR_CODES.SCREENING_NOT_FOUND);
      assertScreeningEligibleForDonation(screening.status);
      if (screening.donation) {
        throw AppError.conflict(
          ERROR_CODES.CERTIFICATE_NOT_ALLOWED,
          'Lượt hiến máu này đã ghi nhận túi máu/chứng nhận',
        );
      }

      const now = new Date();
      const donation = await repo.createDonation(tx, {
        screeningId,
        status: 'COMPLETED',
        performedById: staffUserId,
        startedAt: now,
        completedAt: now,
        donatedAt: now,
        volumeMl: totalVolumeMl,
      });

      const bloodBags = await repo.createBags(
        tx,
        bags.map((b) => ({ ...b, donationId: donation.id })),
      );

      const certificate = await repo.createCertificate(tx, {
        donationId: donation.id,
        code: generateCertificateCode(),
      });

      await auditLogService.record(
        {
          ...ctx,
          action: AUDIT_ACTIONS.DONATION_COMPLETED,
          entityType: AUDIT_ENTITY_TYPES.DONATION,
          entityId: donation.id,
          metadata: { auto: true, bagCount: bloodBags.length },
        },
        tx,
      );
      await auditLogService.record(
        {
          ...ctx,
          action: AUDIT_ACTIONS.CERTIFICATE_ISSUED,
          entityType: AUDIT_ENTITY_TYPES.CERTIFICATE,
          entityId: certificate.id,
        },
        tx,
      );

      const notification = await notificationService.create(tx, {
        userId: screening.checkIn.registration.donor.userId,
        type: 'CERTIFICATE',
        title: 'Chứng nhận hiến máu',
        message: `Cảm ơn bạn đã hiến máu! Mã chứng nhận: ${certificate.code}.`,
        channel: 'EMAIL',
      });

      // Donation stays out of the response — hidden per choice B.
      return { bloodBags, certificate, notification };
    });
    void notificationService.dispatch(result.notification);
    return { bloodBags: result.bloodBags, certificate: result.certificate };
  },
};

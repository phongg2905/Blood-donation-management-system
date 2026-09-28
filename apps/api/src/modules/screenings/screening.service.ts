import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  ERROR_CODES,
} from '@blood/shared-types';
import { AppError } from '../../common/errors/app.error';
import type { AuditContext } from '../audit-logs/audit.service';
import { auditLogService } from '../audit-logs/audit.service';
import { notificationService } from '../notifications/notification.service';
import { screeningRepository as repo } from './screening.repository';
import {
  assertScreeningTransition,
  validateScreeningMeasurements,
  validateScreeningReview,
  validateScreeningTests,
} from './screening.validation';

export const screeningService = {
  /** One combined step: check-in must exist and not already have a screening. */
  async create(
    checkInId: string,
    input: unknown,
    staffUserId: string,
    ctx: AuditContext,
  ) {
    const body = input as { measurements?: unknown; tests?: unknown };
    const measurements = validateScreeningMeasurements(body.measurements ?? {});
    const tests = validateScreeningTests(body.tests ?? []);

    return repo.transaction(async (tx) => {
      const checkIn = await repo.findCheckInTx(tx, checkInId);
      if (!checkIn) throw AppError.notFound(ERROR_CODES.CHECK_IN_REQUIRED);
      if (checkIn.screening) {
        throw AppError.conflict(
          ERROR_CODES.SCREENING_INVALID_TRANSITION,
          'Đã có sàng lọc cho lượt check-in này',
        );
      }

      const screening = await repo.create(tx, {
        checkInId,
        status: 'WAITING_REVIEW',
        screenedById: staffUserId,
        ...measurements,
      });
      if (tests.length > 0) {
        await repo.createTests(
          tx,
          tests.map((t) => ({ ...t, screeningId: screening.id })),
        );
      }
      await auditLogService.record(
        {
          ...ctx,
          action: AUDIT_ACTIONS.SCREENING_UPDATED,
          entityType: AUDIT_ENTITY_TYPES.SCREENING,
          entityId: screening.id,
        },
        tx,
      );
      return screening;
    });
  },

  async getById(id: string) {
    const screening = await repo.findById(id);
    if (!screening) throw AppError.notFound(ERROR_CODES.SCREENING_NOT_FOUND);
    return screening;
  },

  async review(id: string, input: unknown, ctx: AuditContext) {
    const review = validateScreeningReview(input);
    const { updated, notification } = await repo.transaction(async (tx) => {
      const existing = await repo.findWithDonorTx(tx, id);
      if (!existing) throw AppError.notFound(ERROR_CODES.SCREENING_NOT_FOUND);
      assertScreeningTransition(existing.status, review.status);

      const updated = await repo.update(tx, id, {
        status: review.status,
        decisionReason: review.decisionReason,
        deferredUntil: review.deferredUntil,
        notes: review.notes,
      });
      await auditLogService.record(
        {
          ...ctx,
          action: AUDIT_ACTIONS.SCREENING_REVIEWED,
          entityType: AUDIT_ENTITY_TYPES.SCREENING,
          entityId: id,
          metadata: { status: review.status },
        },
        tx,
      );
      // Only a negative outcome needs the donor's attention; ELIGIBLE flows
      // straight into the certificate notification at stage 5.
      const notification =
        review.status === 'INELIGIBLE' || review.status === 'DEFERRED'
          ? await notificationService.create(tx, {
              userId: existing.checkIn.registration.donor.userId,
              type: 'DONATION',
              title: 'Kết quả sàng lọc',
              message:
                review.status === 'DEFERRED'
                  ? 'Bạn cần hoãn hiến máu lần này. Vui lòng liên hệ nhân viên để biết thêm chi tiết.'
                  : 'Rất tiếc, bạn chưa đủ điều kiện hiến máu lần này.',
              channel: 'EMAIL',
            })
          : null;
      return { updated, notification };
    });
    if (notification) void notificationService.dispatch(notification);
    return updated;
  },
};

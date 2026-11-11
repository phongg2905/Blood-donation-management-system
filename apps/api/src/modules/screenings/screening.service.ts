import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  ERROR_CODES,
} from '@blood/shared-types';
import { AppError } from '../../common/errors/app.error';
import { database } from '../../config/database';
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
      if (checkIn.registration.donor.userId === staffUserId) {
        throw AppError.forbidden(
          ERROR_CODES.FORBIDDEN,
          'Nhân viên y tế không được phép tự khám sàng lọc cho chính mình',
        );
      }
      const staffAssignment = await tx.campaignStaff.findUnique({
        where: {
          campaignId_userId: {
            campaignId: checkIn.registration.campaignId,
            userId: staffUserId,
          },
        },
      });
      if (!staffAssignment) {
        throw AppError.forbidden(
          ERROR_CODES.FORBIDDEN,
          'Bạn chưa được điều phối viên phân công làm việc tại đợt hiến máu này',
        );
      }
      if (staffAssignment.assignment !== 'SCREENING') {
        throw AppError.forbidden(
          ERROR_CODES.FORBIDDEN,
          'Bạn được phân công vị trí khác trong đợt hiến này, không thể thực hiện Khám sàng lọc',
        );
      }
      if (checkIn.screening) {
        if (
          checkIn.screening.status === 'ELIGIBLE' ||
          checkIn.screening.status === 'INELIGIBLE' ||
          checkIn.screening.status === 'DEFERRED'
        ) {
          throw AppError.conflict(
            ERROR_CODES.SCREENING_INVALID_TRANSITION,
            'Đã có kết luận sàng lọc cho lượt check-in này',
          );
        }
        const updatedScreening = await repo.update(tx, checkIn.screening.id, {
          status: 'WAITING_REVIEW',
          screenedById: staffUserId,
          ...measurements,
        });
        await tx.screeningTest.deleteMany({
          where: { screeningId: checkIn.screening.id },
        });
        if (tests.length > 0) {
          await repo.createTests(
            tx,
            tests.map((t) => ({ ...t, screeningId: checkIn.screening!.id })),
          );
        }
        await auditLogService.record(
          {
            ...ctx,
            action: AUDIT_ACTIONS.SCREENING_UPDATED,
            entityType: AUDIT_ENTITY_TYPES.SCREENING,
            entityId: updatedScreening.id,
          },
          tx,
        );
        return tx.screening.findUnique({
          where: { id: updatedScreening.id },
          include: { tests: true },
        });
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
      return tx.screening.findUnique({
        where: { id: screening.id },
        include: { tests: true },
      });
    });
  },

  /** All checked-in donors in the screening workflow (both waiting and reviewed). */
  async queue() {
    return database.checkIn.findMany({
      include: {
        screening: {
          include: {
            tests: true,
          },
        },
        registration: {
          include: {
            donor: { include: { user: { select: { fullName: true } } } },
            campaign: { select: { id: true, name: true, location: true, startsAt: true, endsAt: true } },
            timeSlot: true,
            healthDeclaration: true,
          },
        },
      },
      orderBy: { checkedInAt: 'asc' },
    });
  },

  async getById(id: string) {
    const screening = await repo.findById(id);
    if (!screening) throw AppError.notFound(ERROR_CODES.SCREENING_NOT_FOUND);
    return screening;
  },

  async review(id: string, input: unknown, ctx: AuditContext) {
    const review = validateScreeningReview(input);
    if (
      (review.status === 'INELIGIBLE' || review.status === 'DEFERRED') &&
      !review.decisionReason?.trim()
    ) {
      throw AppError.badRequest(ERROR_CODES.SCREENING_REVIEW_REASON_REQUIRED);
    }
    const { updated, notification } = await repo.transaction(async (tx) => {
      const existing = await repo.findWithDonorTx(tx, id);
      if (!existing) throw AppError.notFound(ERROR_CODES.SCREENING_NOT_FOUND);
      if (
        ctx.actorId &&
        existing.checkIn.registration.donor.userId === ctx.actorId
      ) {
        throw AppError.forbidden(
          ERROR_CODES.FORBIDDEN,
          'Nhân viên y tế không được phép tự kết luận sàng lọc cho chính mình',
        );
      }
      if (ctx.actorId) {
        const staffAssignment = await tx.campaignStaff.findUnique({
          where: {
            campaignId_userId: {
              campaignId: existing.checkIn.registration.campaignId,
              userId: ctx.actorId,
            },
          },
        });
        if (!staffAssignment) {
          throw AppError.forbidden(
            ERROR_CODES.FORBIDDEN,
            'Bạn chưa được điều phối viên phân công làm việc tại đợt hiến máu này',
          );
        }
        if (staffAssignment.assignment !== 'SCREENING') {
          throw AppError.forbidden(
            ERROR_CODES.FORBIDDEN,
            'Bạn được phân công vị trí khác trong đợt hiến này, không thể kết luận Khám sàng lọc',
          );
        }
      }
      assertScreeningTransition(existing.status, review.status);

      const updated = await repo.update(tx, id, {
        status: review.status,
        decisionReason: review.decisionReason,
        deferredUntil: review.deferredUntil,
        indicatedVolumeMl: review.indicatedVolumeMl,
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

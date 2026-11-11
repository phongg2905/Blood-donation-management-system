import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  ERROR_CODES,
} from '@blood/shared-types';
import { AppError } from '../../common/errors/app.error';
import type { AuditContext } from '../audit-logs/audit.service';
import { auditLogService } from '../audit-logs/audit.service';
import {
  assertCanCheckIn,
  assertCanMarkNoShow,
} from '../registrations/registration.validation';
import { checkInRepository as repo } from './check-in.repository';

export const checkInService = {
  async checkIn(
    registrationId: string,
    staffUserId: string,
    ctx: AuditContext,
  ) {
    return repo.transaction(async (tx) => {
      const registration = await repo.findRegistrationTx(tx, registrationId);
      if (!registration)
        throw AppError.notFound(ERROR_CODES.REGISTRATION_NOT_FOUND);
      if (registration.donor.userId === staffUserId) {
        throw AppError.forbidden(
          ERROR_CODES.FORBIDDEN,
          'Nhân viên không được phép tự tiếp nhận lượt hiến máu của chính mình',
        );
      }
      const staffAssignment = await tx.campaignStaff.findUnique({
        where: {
          campaignId_userId: {
            campaignId: registration.campaignId,
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
      if (staffAssignment.assignment !== 'CHECK_IN') {
        throw AppError.forbidden(
          ERROR_CODES.FORBIDDEN,
          'Bạn được phân công vị trí khác trong đợt hiến này, không thể thực hiện Tiếp nhận (Check-in)',
        );
      }
      if (
        registration.campaign.status === 'DRAFT' ||
        registration.campaign.status === 'CANCELLED'
      ) {
        throw AppError.conflict(
          ERROR_CODES.CHECK_IN_NOT_ALLOWED,
          'Không thể tiếp nhận cho đợt hiến máu ở trạng thái nháp hoặc đã hủy',
        );
      }
      if (!registration.healthDeclaration) {
        throw AppError.conflict(
          ERROR_CODES.CHECK_IN_NOT_ALLOWED,
          'Người hiến máu chưa hoàn thành tờ khai y tế',
        );
      }
      assertCanCheckIn(registration.status, {
        alreadyCheckedIn: !!registration.checkIn,
      });

      const checkIn = await repo.create(tx, {
        registrationId,
        checkedInById: staffUserId,
      });
      await repo.markCheckedIn(tx, registrationId);
      await auditLogService.record(
        {
          ...ctx,
          action: AUDIT_ACTIONS.REGISTRATION_CHECKED_IN,
          entityType: AUDIT_ENTITY_TYPES.CHECK_IN,
          entityId: checkIn.id,
        },
        tx,
      );
      return checkIn;
    });
  },

  async markNoShow(registrationId: string, ctx: AuditContext) {
    return repo.transaction(async (tx) => {
      const registration = await repo.findRegistrationTx(tx, registrationId);
      if (!registration)
        throw AppError.notFound(ERROR_CODES.REGISTRATION_NOT_FOUND);
      if (ctx.actorId) {
        const staffAssignment = await tx.campaignStaff.findUnique({
          where: {
            campaignId_userId: {
              campaignId: registration.campaignId,
              userId: ctx.actorId,
            },
          },
        });
        if (!staffAssignment || staffAssignment.assignment !== 'CHECK_IN') {
          throw AppError.forbidden(
            ERROR_CODES.FORBIDDEN,
            'Bạn không được phân công vị trí Tiếp nhận tại đợt hiến máu này',
          );
        }
      }
      assertCanMarkNoShow(registration.status);

      const updated = await repo.markNoShow(tx, registrationId);
      await auditLogService.record(
        {
          ...ctx,
          action: AUDIT_ACTIONS.REGISTRATION_NO_SHOW,
          entityType: AUDIT_ENTITY_TYPES.REGISTRATION,
          entityId: registrationId,
        },
        tx,
      );
      return updated;
    });
  },
};

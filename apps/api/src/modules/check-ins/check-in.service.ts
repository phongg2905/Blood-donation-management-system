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
      assertCanCheckIn(registration.status, {
        alreadyCheckedIn: !!registration.checkIn,
      });

      const checkIn = await repo.create(tx, {
        registrationId,
        checkedInById: staffUserId,
      });
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

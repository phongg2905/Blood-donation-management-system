import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  ERROR_CODES,
} from '@blood/shared-types';
import { AppError } from '../../common/errors/app.error';
import type { AuditContext } from '../audit-logs/audit.service';
import { auditLogService } from '../audit-logs/audit.service';
import { campaignStaffRepository as repo } from './campaign-staff.repository';
import { validateAssignStaff } from './campaign-staff.validation';

export const campaignStaffService = {
  list: (campaignId: string) => repo.listByCampaign(campaignId),

  async assign(campaignId: string, input: unknown, ctx: AuditContext) {
    const data = validateAssignStaff(input);
    return repo.transaction(async (tx) => {
      const campaign = await repo.campaignExistsTx(tx, campaignId);
      if (!campaign) throw AppError.notFound(ERROR_CODES.CAMPAIGN_NOT_FOUND);

      const roles = await repo.userRoleCodesTx(tx, data.userId);
      if (roles.length === 0 || roles.includes('DONOR')) {
        throw AppError.badRequest(ERROR_CODES.CAMPAIGN_STAFF_INVALID_ROLE);
      }

      const existing = await repo.findAssignmentTx(tx, campaignId, data.userId);
      if (existing) {
        throw AppError.conflict(ERROR_CODES.CAMPAIGN_STAFF_ALREADY_ASSIGNED);
      }

      const created = await repo.create(tx, {
        campaignId,
        userId: data.userId,
        assignment: data.assignment ?? null,
      });
      await auditLogService.record(
        {
          ...ctx,
          action: AUDIT_ACTIONS.STAFF_ASSIGNED,
          entityType: AUDIT_ENTITY_TYPES.CAMPAIGN_STAFF,
          entityId: created.id,
          metadata: {
            campaignId,
            userId: data.userId,
            assignment: data.assignment ?? null,
          },
        },
        tx,
      );
      return created;
    });
  },

  async remove(campaignId: string, userId: string, ctx: AuditContext) {
    return repo.transaction(async (tx) => {
      const existing = await repo.findAssignmentTx(tx, campaignId, userId);
      if (!existing)
        throw AppError.notFound(ERROR_CODES.CAMPAIGN_STAFF_NOT_FOUND);

      await repo.remove(tx, campaignId, userId);
      await auditLogService.record(
        {
          ...ctx,
          action: AUDIT_ACTIONS.STAFF_REMOVED,
          entityType: AUDIT_ENTITY_TYPES.CAMPAIGN_STAFF,
          entityId: existing.id,
          metadata: { campaignId, userId },
        },
        tx,
      );
    });
  },
};

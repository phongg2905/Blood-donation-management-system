import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  ERROR_CODES,
  type CampaignStatus,
} from '@blood/shared-types';
import { AppError } from '../../common/errors/app.error';
import type { AuditContext } from '../audit-logs/audit.service';
import { auditLogService } from '../audit-logs/audit.service';
import {
  paginationMeta,
  resolvePagination,
} from '../../common/helpers/response';
import { campaignRepository as repo } from './campaign.repository';
import {
  assertCampaignEditable,
  assertCampaignTransition,
  validateCampaign,
  validateCampaignListQuery,
  validateCampaignPatch,
  validateCancelCampaign,
  validateCreateCampaign,
} from './campaign.validation';

type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

async function transition(
  id: string,
  to: CampaignStatus,
  action: AuditAction,
  ctx: AuditContext,
  metadata: Record<string, unknown> = {},
) {
  return repo.transaction(async (tx) => {
    const existing = await repo.findByIdTx(tx, id);
    if (!existing) throw AppError.notFound(ERROR_CODES.CAMPAIGN_NOT_FOUND);
    assertCampaignTransition(existing.status, to);

    const updated = await repo.update(tx, id, { status: to });
    await auditLogService.record(
      {
        ...ctx,
        action,
        entityType: AUDIT_ENTITY_TYPES.CAMPAIGN,
        entityId: id,
        metadata: { from: existing.status, to, ...metadata },
      },
      tx,
    );
    return updated;
  });
}

export const campaignService = {
  async list(query: unknown) {
    const filters = validateCampaignListQuery(query);
    const pagination = resolvePagination(filters);
    const { items, total } = await repo.list({
      status: filters.status,
      from: filters.from,
      to: filters.to,
      skip: pagination.skip,
      take: pagination.take,
    });
    return {
      items,
      meta: paginationMeta(pagination.page, pagination.limit, total),
    };
  },

  async getById(id: string) {
    const campaign = await repo.findById(id);
    if (!campaign) throw AppError.notFound(ERROR_CODES.CAMPAIGN_NOT_FOUND);
    return campaign;
  },

  async create(input: unknown, ctx: AuditContext) {
    const data = validateCreateCampaign(input);
    return repo.transaction(async (tx) => {
      const created = await repo.create(tx, data);
      await auditLogService.record(
        {
          ...ctx,
          action: AUDIT_ACTIONS.CAMPAIGN_CREATED,
          entityType: AUDIT_ENTITY_TYPES.CAMPAIGN,
          entityId: created.id,
        },
        tx,
      );
      return created;
    });
  },

  /**
   * Merges the patch onto the existing row and re-validates the *resulting*
   * record — a partial patch can never leave startsAt/endsAt or the target
   * fields in an inconsistent state (see campaign.validation.ts).
   */
  async update(id: string, input: unknown, ctx: AuditContext) {
    const patch = validateCampaignPatch(input);
    return repo.transaction(async (tx) => {
      const existing = await repo.findByIdTx(tx, id);
      if (!existing) throw AppError.notFound(ERROR_CODES.CAMPAIGN_NOT_FOUND);
      assertCampaignEditable(existing.status);

      const merged = { ...existing, ...patch };
      const data = validateCampaign(merged);

      const updated = await repo.update(tx, id, data);
      await auditLogService.record(
        {
          ...ctx,
          action: AUDIT_ACTIONS.CAMPAIGN_UPDATED,
          entityType: AUDIT_ENTITY_TYPES.CAMPAIGN,
          entityId: id,
          metadata: { fields: Object.keys(patch) },
        },
        tx,
      );
      return updated;
    });
  },

  open: (id: string, ctx: AuditContext) =>
    transition(id, 'OPEN', AUDIT_ACTIONS.CAMPAIGN_OPENED, ctx),

  close: (id: string, ctx: AuditContext) =>
    transition(id, 'CLOSED', AUDIT_ACTIONS.CAMPAIGN_CLOSED, ctx),

  cancel: (id: string, input: unknown, ctx: AuditContext) => {
    const { reason } = validateCancelCampaign(input);
    return transition(id, 'CANCELLED', AUDIT_ACTIONS.CAMPAIGN_CANCELLED, ctx, {
      reason: reason ?? null,
    });
  },
};

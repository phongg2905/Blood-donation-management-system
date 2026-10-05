import { z } from 'zod';
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  ERROR_CODES,
} from '@blood/shared-types';
import { AppError } from '../../common/errors/app.error';
import { parseDomain } from '../../common/helpers/domain-validation';
import {
  paginationMeta,
  resolvePagination,
} from '../../common/helpers/response';
import type { AuditContext } from '../audit-logs/audit.service';
import { auditLogService } from '../audit-logs/audit.service';
import { database } from '../../config/database';
import { certificateRepository as repo } from './certificate.repository';

const fileSchema = z.object({
  fileUrl: z
    .string()
    .trim()
    .max(2048)
    .url()
    .refine((u) => u.startsWith('https://'), 'fileUrl phải dùng https'),
});
const revokeSchema = z.object({
  reason: z.string().trim().min(1).max(500).optional(),
});
const listQuerySchema = z.object({
  donorUserId: z.string().uuid().optional(),
  status: z.string().trim().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

export const certificateService = {
  /** Records where the (externally stored) certificate PDF lives; no file bytes go through this API. */
  async attachFile(id: string, input: unknown, ctx: AuditContext) {
    const { fileUrl } = parseDomain(fileSchema, input);
    const certificate = await repo.findById(id);
    if (!certificate)
      throw AppError.notFound(ERROR_CODES.CERTIFICATE_NOT_FOUND);
    if (certificate.status !== 'ACTIVE') {
      throw AppError.conflict(
        ERROR_CODES.CERTIFICATE_NOT_ALLOWED,
        'Chứng nhận đã bị thu hồi',
      );
    }
    const updated = await repo.setFileUrl(id, fileUrl);
    await auditLogService.recordSafely(
      {
        ...ctx,
        action: AUDIT_ACTIONS.CERTIFICATE_ISSUED,
        entityType: AUDIT_ENTITY_TYPES.CERTIFICATE,
        entityId: id,
        metadata: { fileAttached: true },
      },
      database,
    );
    return updated;
  },

  /** Administrative override — corrects a wrongly issued certificate. SYSTEM_ADMIN only. */
  async revoke(id: string, input: unknown, ctx: AuditContext) {
    const { reason } = parseDomain(revokeSchema, input ?? {});
    const certificate = await repo.findById(id);
    if (!certificate)
      throw AppError.notFound(ERROR_CODES.CERTIFICATE_NOT_FOUND);
    if (certificate.status !== 'ACTIVE') {
      throw AppError.conflict(
        ERROR_CODES.CERTIFICATE_NOT_ALLOWED,
        'Chứng nhận đã bị thu hồi trước đó',
      );
    }
    const updated = await repo.revoke(id, reason);
    await auditLogService.recordSafely(
      {
        ...ctx,
        action: AUDIT_ACTIONS.CERTIFICATE_REVOKED,
        entityType: AUDIT_ENTITY_TYPES.CERTIFICATE,
        entityId: id,
        metadata: { reason: reason ?? null },
      },
      database,
    );
    return updated;
  },

  async list(query: unknown) {
    const filters = parseDomain(listQuerySchema, query);
    const pagination = resolvePagination(filters);
    const { items, total } = await repo.list({
      donorUserId: filters.donorUserId,
      status: filters.status,
      skip: pagination.skip,
      take: pagination.take,
    });
    return {
      items,
      meta: paginationMeta(pagination.page, pagination.limit, total),
    };
  },
};

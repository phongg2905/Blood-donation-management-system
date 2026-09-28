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

export const certificateService = {
  /** Records where the (externally stored) certificate PDF lives; no file bytes go through this API. */
  async attachFile(id: string, input: unknown, ctx: AuditContext) {
    const { fileUrl } = parseDomain(fileSchema, input);
    const certificate = await repo.findById(id);
    if (!certificate)
      throw AppError.notFound(
        ERROR_CODES.DONATION_NOT_FOUND,
        'Không tìm thấy chứng nhận',
      );
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
};

import type { Request } from 'express';
import {
  auditLogRepository,
  type AuditClient,
  type AuditLogInput,
} from './audit-log.repository';

export interface AuditContext {
  actorId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
}

/** Extracts audit context from the request; actor comes from verified auth only. */
export const auditContextFrom = (req: Request): AuditContext => ({
  actorId: req.auth?.userId ?? null,
  ipAddress: req.ip ?? null,
  userAgent: req.get('user-agent') ?? null,
});

export type AuditRecordInput = Omit<
  AuditLogInput,
  'actorId' | 'ipAddress' | 'userAgent'
> &
  Partial<Pick<AuditLogInput, 'actorId' | 'ipAddress' | 'userAgent'>>;

/**
 * Phase 1 audit foundation. Call inside the owning transaction so the log and
 * the business change commit together:
 *
 *   await auditLogService.record({ ...input, ...auditContextFrom(req) }, tx);
 *
 * Phase 8 only adds querying and an admin UI on top of this.
 */
export const auditLogService = {
  record(
    input: AuditRecordInput,
    client: AuditClient,
  ): Promise<{ id: string }> {
    return auditLogRepository.create(client, {
      ...input,
      actorId: input.actorId ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    });
  },

  /**
   * Best-effort variant for non-transactional call sites (e.g. LOGIN_FAILED for
   * an unknown email). Never leaks audit errors into the response.
   */
  async recordSafely(
    input: AuditRecordInput,
    client: AuditClient,
  ): Promise<void> {
    try {
      await auditLogService.record(input, client);
    } catch (error) {
      console.error('Audit log write failed', input.action, error);
    }
  },
};

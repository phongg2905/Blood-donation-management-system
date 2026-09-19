import { Prisma } from '@prisma/client';
import type { AuditAction, AuditEntityType } from '@blood/shared-types';
import { database } from '../../config/database';

export interface AuditLogInput {
  actorId: string | null;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/** `tx` is supplied whenever the audit entry must share a business transaction. */
export type AuditClient = Prisma.TransactionClient | typeof database;

export const auditLogRepository = {
  create(client: AuditClient, input: AuditLogInput): Promise<{ id: string }> {
    return client.auditLog.create({
      data: {
        actorId: input.actorId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        metadata: input.metadata ?? Prisma.JsonNull,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
      select: { id: true },
    });
  },
};

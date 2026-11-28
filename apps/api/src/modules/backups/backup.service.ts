import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  ERROR_CODES,
} from '@blood/shared-types';
import { AppError } from '../../common/errors/app.error';
import {
  paginationMeta,
  resolvePagination,
} from '../../common/helpers/response';
import { database } from '../../config/database';
import type { AuditContext } from '../audit-logs/audit.service';
import { auditLogService } from '../audit-logs/audit.service';
import { backupRepository as repo } from './backup.repository';
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  computeSnapshotChecksum,
  parseAndVerifySnapshot,
  summarizeTableCounts,
  validateExportRequest,
  validateHistoryQuery,
  type BackupSnapshot,
  type BackupSnapshotPayload,
} from './backup.validation';

export const backupService = {
  summary() {
    return repo.getSummary();
  },

  async history(input: unknown) {
    const query = validateHistoryQuery(input);
    const { page, limit, skip, take } = resolvePagination(query);
    const { items, total } = await repo.listHistory(skip, take);
    return {
      items: items.map((entry) => ({
        id: entry.id,
        action: entry.action,
        createdAt: entry.createdAt.toISOString(),
        actorId: entry.actorId,
        actorEmail: entry.actor?.email ?? null,
        actorName: entry.actor?.fullName ?? null,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent ?? null,
        metadata: (entry.metadata as Record<string, unknown> | null) ?? null,
      })),
      meta: paginationMeta(page, limit, total),
    };
  },

  async exportSnapshot(input: unknown, ctx: AuditContext) {
    const startedAtMs = Date.now();
    const options = validateExportRequest(input);
    const tables = await repo.exportAllTables(options.includeCredentials);
    const createdAt = new Date().toISOString();
    const restorable = options.includeCredentials;

    const payload: BackupSnapshotPayload = {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      createdAt,
      includeCredentials: options.includeCredentials,
      restorable,
      tables,
    };

    const checksumSha256 = computeSnapshotChecksum(payload);
    const { counts, totalRecords } = summarizeTableCounts(tables);
    const actor = ctx.actorId
      ? await database.user.findUnique({
          where: { id: ctx.actorId },
          select: { email: true },
        })
      : null;

    const snapshot: BackupSnapshot = {
      ...payload,
      createdBy: { id: ctx.actorId, email: actor?.email ?? null },
      counts,
      totalRecords,
      checksumSha256,
    };

    const stamp = createdAt.replace(/[:.]/g, '-').slice(0, 19);
    const filename = `blood-donation-backup-${stamp}.json`;
    const sizeBytes = Buffer.byteLength(JSON.stringify(snapshot), 'utf8');
    const durationMs = Math.max(0, Date.now() - startedAtMs);

    await auditLogService.recordSafely(
      {
        ...ctx,
        action: AUDIT_ACTIONS.SYSTEM_BACKUP_CREATED,
        entityType: AUDIT_ENTITY_TYPES.SYSTEM_BACKUP,
        metadata: {
          filename,
          format: BACKUP_FORMAT,
          version: BACKUP_VERSION,
          snapshotCreatedAt: createdAt,
          checksumSha256,
          totalRecords,
          counts,
          sizeBytes,
          durationMs,
          includeCredentials: options.includeCredentials,
          restorable,
          note: options.note ?? null,
        },
      },
      database,
    );

    return { filename, snapshot };
  },

  inspect(input: unknown) {
    const { snapshot, counts, totalRecords } = parseAndVerifySnapshot(input);
    return {
      valid: true,
      format: snapshot.format,
      version: snapshot.version,
      createdAt: snapshot.createdAt,
      includeCredentials: snapshot.includeCredentials,
      restorable: snapshot.restorable,
      checksumSha256: snapshot.checksumSha256,
      counts,
      totalRecords,
    };
  },

  async restore(
    input: unknown,
    ctx: AuditContext,
    options?: { filename?: string | null },
  ) {
    const startedAtMs = Date.now();
    const { snapshot, counts, totalRecords } = parseAndVerifySnapshot(input);
    if (!snapshot.restorable || !snapshot.includeCredentials) {
      throw AppError.badRequest(
        ERROR_CODES.BACKUP_INVALID_FILE,
        'Bản sao lưu ẩn thông tin xác thực không hỗ trợ khôi phục hệ thống.',
      );
    }

    const sourceFilename =
      typeof options?.filename === 'string' && options.filename.trim()
        ? options.filename.trim().slice(0, 200)
        : null;
    const snapshotCreatedBy = snapshot.createdBy
      ? {
          id: snapshot.createdBy.id ?? null,
          email: snapshot.createdBy.email ?? null,
        }
      : null;

    await repo.restoreAllTables(snapshot.tables, async (tx, preRestore) => {
      const actorExists = ctx.actorId
        ? await tx.user.findUnique({
            where: { id: ctx.actorId },
            select: { id: true },
          })
        : null;
      await auditLogService.record(
        {
          ...ctx,
          actorId: actorExists ? ctx.actorId : null,
          action: AUDIT_ACTIONS.SYSTEM_BACKUP_RESTORED,
          entityType: AUDIT_ENTITY_TYPES.SYSTEM_BACKUP,
          metadata: {
            filename: sourceFilename,
            format: snapshot.format,
            version: snapshot.version,
            restoredFromCreatedAt: snapshot.createdAt,
            snapshotCreatedBy,
            includeCredentials: snapshot.includeCredentials,
            restorable: snapshot.restorable,
            checksumSha256: snapshot.checksumSha256,
            durationMs: Math.max(0, Date.now() - startedAtMs),
            totalRecords,
            counts,
            previousTotalRecords: preRestore.previousTotalRecords,
            previousCounts: preRestore.previousCounts,
          },
        },
        tx,
      );
    });

    return {
      restored: true,
      restoredFromCreatedAt: snapshot.createdAt,
      checksumSha256: snapshot.checksumSha256,
      totalRecords,
      counts,
    };
  },
};

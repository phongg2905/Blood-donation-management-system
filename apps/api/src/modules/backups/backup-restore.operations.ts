import { randomUUID } from 'node:crypto';
import { ERROR_CODES } from '@blood/shared-types';
import { AppError } from '../../common/errors/app.error';
import type { AuditContext } from '../audit-logs/audit.service';
import { backupService } from './backup.service';

type RestoreResult = Awaited<ReturnType<typeof backupService.restore>>;

interface RestoreOperation {
  id: string;
  actorId: string;
  status: 'running' | 'succeeded' | 'failed';
  startedAt: string;
  finishedAt: string | null;
  result: RestoreResult | null;
  error: string | null;
}

const operations = new Map<string, RestoreOperation>();
const RETENTION_MS = 60 * 60 * 1000;
let activeOperationId: string | null = null;

function pruneFinishedOperations() {
  const cutoff = Date.now() - RETENTION_MS;
  for (const [id, operation] of operations) {
    if (operation.finishedAt && Date.parse(operation.finishedAt) < cutoff) {
      operations.delete(id);
    }
  }
}

function publicStatus(operation: RestoreOperation) {
  return {
    id: operation.id,
    status: operation.status,
    startedAt: operation.startedAt,
    finishedAt: operation.finishedAt,
    result: operation.result,
    error: operation.error,
  };
}

export const backupRestoreOperations = {
  start(
    input: unknown,
    ctx: AuditContext,
    requestedId?: unknown,
    filename?: string | null,
  ) {
    pruneFinishedOperations();
    const actorId = ctx.actorId;
    if (!actorId) throw AppError.unauthorized();
    if (
      requestedId !== undefined &&
      (typeof requestedId !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          requestedId,
        ))
    ) {
      throw AppError.badRequest(ERROR_CODES.REQUEST_INVALID);
    }
    const id = typeof requestedId === 'string' ? requestedId : randomUUID();
    const previous = operations.get(id);
    if (previous) {
      if (previous.actorId !== actorId) {
        throw AppError.notFound(ERROR_CODES.ROUTE_NOT_FOUND);
      }
      return publicStatus(previous);
    }
    if (activeOperationId) {
      throw new AppError(
        ERROR_CODES.REQUEST_INVALID,
        409,
        'Một lần khôi phục khác đang chạy. Vui lòng chờ hoàn tất.',
      );
    }

    // Reject invalid and non-restorable files before accepting the job.
    const inspection = backupService.inspect(input);
    if (!inspection.restorable || !inspection.includeCredentials) {
      throw AppError.badRequest(ERROR_CODES.BACKUP_INVALID_FILE);
    }

    const operation: RestoreOperation = {
      id,
      actorId,
      status: 'running',
      startedAt: new Date().toISOString(),
      finishedAt: null,
      result: null,
      error: null,
    };
    operations.set(operation.id, operation);
    activeOperationId = operation.id;

    void Promise.resolve()
      .then(() => backupService.restore(input, ctx, { filename }))
      .then((result) => {
        operation.status = 'succeeded';
        operation.result = result;
      })
      .catch((error: unknown) => {
        console.error('Backup restore failed:', error);
        operation.status = 'failed';
        operation.error =
          error instanceof AppError
            ? error.message
            : 'Khôi phục thất bại. Dữ liệu hiện tại được giữ nguyên.';
      })
      .finally(() => {
        operation.finishedAt = new Date().toISOString();
        activeOperationId = null;
      });

    return publicStatus(operation);
  },

  get(id: string, actorId: string | null) {
    pruneFinishedOperations();
    const operation = operations.get(id);
    if (!operation || operation.actorId !== actorId) {
      throw AppError.notFound(ERROR_CODES.ROUTE_NOT_FOUND);
    }
    return publicStatus(operation);
  },
};

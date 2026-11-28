import type { RequestHandler } from 'express';
import { Router } from 'express';
import { sendList, sendSuccess } from '../../common/helpers/response';
import { requireAuth } from '../../middlewares/auth.middleware';
import { requirePermission } from '../../middlewares/permission.middleware';
import { auditContextFrom } from '../audit-logs/audit.service';
import { backupService } from './backup.service';
import { backupRestoreOperations } from './backup-restore.operations';

const summary: RequestHandler = async (_req, res) => {
  sendSuccess(res, await backupService.summary());
};

const history: RequestHandler = async (req, res) => {
  const { items, meta } = await backupService.history(req.query);
  sendList(res, items, meta.page, meta.limit, meta.total);
};

const exportBackup: RequestHandler = async (req, res) => {
  sendSuccess(
    res,
    await backupService.exportSnapshot(req.body, auditContextFrom(req)),
  );
};

const inspectBackup: RequestHandler = (req, res) => {
  sendSuccess(res, backupService.inspect(req.body));
};

const restoreBackup: RequestHandler = async (req, res) => {
  const filename =
    typeof req.query.filename === 'string' && req.query.filename.trim()
      ? req.query.filename.trim().slice(0, 200)
      : null;
  sendSuccess(
    res,
    backupRestoreOperations.start(
      req.body,
      auditContextFrom(req),
      req.query.operationId,
      filename,
    ),
    202,
  );
};

const restoreStatus: RequestHandler = (req, res) => {
  sendSuccess(
    res,
    backupRestoreOperations.get(
      String(req.params.id),
      req.auth?.userId ?? null,
    ),
  );
};

export const backupRoutes = Router();

backupRoutes.get(
  '/summary',
  requireAuth,
  requirePermission('backup.read'),
  summary,
);
backupRoutes.get(
  '/history',
  requireAuth,
  requirePermission('backup.read'),
  history,
);
backupRoutes.post(
  '/export',
  requireAuth,
  requirePermission('backup.manage'),
  exportBackup,
);
backupRoutes.post(
  '/inspect',
  requireAuth,
  requirePermission('backup.manage'),
  inspectBackup,
);
backupRoutes.post(
  '/restore',
  requireAuth,
  requirePermission('backup.manage'),
  restoreBackup,
);
backupRoutes.get(
  '/restore-operations/:id',
  requireAuth,
  requirePermission('backup.manage'),
  restoreStatus,
);

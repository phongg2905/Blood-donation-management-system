import type { RequestHandler } from 'express';
import { Router } from 'express';
import { sendSuccess } from '../../common/helpers/response';
import { requireAuth } from '../../middlewares/auth.middleware';
import { requirePermission } from '../../middlewares/permission.middleware';
import { auditContextFrom } from '../audit-logs/audit.service';
import { settingsService } from './settings.service';

const list: RequestHandler = async (_req, res) => {
  sendSuccess(res, await settingsService.list());
};

const update: RequestHandler = async (req, res) => {
  const key = req.params.key as string;
  const updated = await settingsService.update(
    key,
    req.body,
    auditContextFrom(req),
  );
  sendSuccess(res, updated);
};

export const settingsRoutes = Router();
settingsRoutes.get('/', requireAuth, requirePermission('setting.read'), list);
settingsRoutes.put('/:key', requireAuth, requirePermission('setting.manage'), update);

import type { RequestHandler } from 'express';
import { Router } from 'express';
import { sendList } from '../../common/helpers/response';
import { requireAuth } from '../../middlewares/auth.middleware';
import { requirePermission } from '../../middlewares/permission.middleware';
import { auditLogService } from './audit.service';

const list: RequestHandler = async (req, res) => {
  const { items, meta } = await auditLogService.list(req.query);
  sendList(res, items, meta.page, meta.limit, meta.total);
};

export const auditLogRoutes = Router();
auditLogRoutes.get('/', requireAuth, requirePermission('audit.read'), list);

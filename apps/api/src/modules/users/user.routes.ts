import type { RequestHandler } from 'express';
import { Router } from 'express';
import { paramId } from '../../common/helpers/http';
import { sendList, sendSuccess } from '../../common/helpers/response';
import { requireAuth } from '../../middlewares/auth.middleware';
import { requirePermission } from '../../middlewares/permission.middleware';
import { auditContextFrom } from '../audit-logs/audit.service';
import { userService } from './user.service';

const list: RequestHandler = async (req, res) => {
  const { items, meta } = await userService.list(req.query);
  sendList(res, items, meta.page, meta.limit, meta.total);
};

const assignRole: RequestHandler = async (req, res) => {
  await userService.assignRole(paramId(req), req.body, auditContextFrom(req));
  sendSuccess(res, {});
};

export const userRoutes = Router();
userRoutes.get('/', requireAuth, requirePermission('user.read'), list);
userRoutes.post(
  '/:id/roles',
  requireAuth,
  requirePermission('user.manage'),
  assignRole,
);

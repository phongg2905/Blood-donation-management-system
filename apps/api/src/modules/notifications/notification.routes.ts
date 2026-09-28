import type { RequestHandler } from 'express';
import { Router } from 'express';
import { AppError } from '../../common/errors/app.error';
import { paramId } from '../../common/helpers/http';
import { sendList, sendSuccess } from '../../common/helpers/response';
import { requireAuth } from '../../middlewares/auth.middleware';
import { requirePermission } from '../../middlewares/permission.middleware';
import { notificationService } from './notification.service';

const list: RequestHandler = async (req, res) => {
  if (!req.auth) throw AppError.unauthorized();
  const { items, meta } = await notificationService.list(
    req.auth.userId,
    req.query as {
      page?: number;
      limit?: number;
    },
  );
  sendList(res, items, meta.page, meta.limit, meta.total);
};

const markRead: RequestHandler = async (req, res) => {
  if (!req.auth) throw AppError.unauthorized();
  await notificationService.markRead(paramId(req), req.auth.userId);
  sendSuccess(res, {});
};

export const notificationRoutes = Router();
notificationRoutes.get(
  '/',
  requireAuth,
  requirePermission('notification.read'),
  list,
);
notificationRoutes.patch(
  '/:id/read',
  requireAuth,
  requirePermission('notification.read'),
  markRead,
);

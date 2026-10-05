import type { RequestHandler } from 'express';
import { Router } from 'express';
import { sendSuccess } from '../../common/helpers/response';
import { requireAuth } from '../../middlewares/auth.middleware';
import { requirePermission } from '../../middlewares/permission.middleware';
import { reportService } from './report.service';

const donations: RequestHandler = async (req, res) => {
  sendSuccess(res, await reportService.donations(req.query));
};

export const reportRoutes = Router();
reportRoutes.get(
  '/donations',
  requireAuth,
  requirePermission('report.read'),
  donations,
);

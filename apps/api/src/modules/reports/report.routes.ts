import type { RequestHandler } from 'express';
import { Router } from 'express';
import { sendSuccess } from '../../common/helpers/response';
import { requireAuth } from '../../middlewares/auth.middleware';
import { requirePermission } from '../../middlewares/permission.middleware';
import { reportService } from './report.service';

const donations: RequestHandler = async (req, res) => {
  sendSuccess(res, await reportService.donations(req.query));
};

const overview: RequestHandler = async (_req, res) => {
  sendSuccess(res, await reportService.overview());
};

export const reportRoutes = Router();
reportRoutes.get(
  '/overview',
  requireAuth,
  requirePermission('report.read'),
  overview,
);
reportRoutes.get(
  '/donations',
  requireAuth,
  requirePermission('report.read'),
  donations,
);

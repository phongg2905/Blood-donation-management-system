import type { RequestHandler } from 'express';
import { Router } from 'express';
import { AppError } from '../../common/errors/app.error';
import { sendSuccess } from '../../common/helpers/response';
import { requireAuth } from '../../middlewares/auth.middleware';
import { requirePermission } from '../../middlewares/permission.middleware';
import { donorService } from './donor.service';

const myHistory: RequestHandler = async (req, res) => {
  if (!req.auth) throw AppError.unauthorized();
  sendSuccess(res, await donorService.myHistory(req.auth.userId));
};

export const donorRoutes = Router();
donorRoutes.get(
  '/me/history',
  requireAuth,
  requirePermission('donation.read'),
  myHistory,
);

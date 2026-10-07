import type { RequestHandler } from 'express';
import { Router } from 'express';
import { AppError } from '../../common/errors/app.error';
import { paramId } from '../../common/helpers/http';
import { sendCreated, sendSuccess } from '../../common/helpers/response';
import { requireAuth } from '../../middlewares/auth.middleware';
import { requirePermission } from '../../middlewares/permission.middleware';
import { auditContextFrom } from '../audit-logs/audit.service';
import { screeningService } from './screening.service';

const create: RequestHandler = async (req, res) => {
  if (!req.auth) throw AppError.unauthorized();
  const { checkInId, ...rest } = req.body as { checkInId: string };
  sendCreated(
    res,
    await screeningService.create(
      checkInId,
      rest,
      req.auth.userId,
      auditContextFrom(req),
    ),
  );
};

const queue: RequestHandler = async (req, res) => {
  sendSuccess(res, await screeningService.queue());
};

const getById: RequestHandler = async (req, res) => {
  sendSuccess(res, await screeningService.getById(paramId(req)));
};

const review: RequestHandler = async (req, res) => {
  sendSuccess(
    res,
    await screeningService.review(
      paramId(req),
      req.body,
      auditContextFrom(req),
    ),
  );
};

export const screeningRoutes = Router();
screeningRoutes.post(
  '/',
  requireAuth,
  requirePermission('screening.create'),
  create,
);
screeningRoutes.get(
  '/queue',
  requireAuth,
  requirePermission('screening.read'),
  queue,
);
screeningRoutes.get(
  '/:id',
  requireAuth,
  requirePermission('screening.read'),
  getById,
);
screeningRoutes.post(
  '/:id/review',
  requireAuth,
  requirePermission('screening.review'),
  review,
);

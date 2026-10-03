import type { RequestHandler } from 'express';
import { Router } from 'express';
import { paramId } from '../../common/helpers/http';
import { sendCreated, sendSuccess } from '../../common/helpers/response';
import { requireAuth } from '../../middlewares/auth.middleware';
import { requirePermission } from '../../middlewares/permission.middleware';
import { auditContextFrom } from '../audit-logs/audit.service';
import { timeSlotService } from './time-slot.service';

const listForCampaign: RequestHandler = async (req, res) => {
  const activeOnly = req.query.activeOnly === 'true';
  sendSuccess(
    res,
    await timeSlotService.list(paramId(req, 'campaignId'), activeOnly),
  );
};

const createForCampaign: RequestHandler = async (req, res) => {
  const body = { ...req.body, campaignId: paramId(req, 'campaignId') };
  sendCreated(res, await timeSlotService.create(body));
};

const getById: RequestHandler = async (req, res) => {
  sendSuccess(res, await timeSlotService.getById(paramId(req)));
};

const update: RequestHandler = async (req, res) => {
  sendSuccess(
    res,
    await timeSlotService.update(paramId(req), req.body, auditContextFrom(req)),
  );
};

const deactivate: RequestHandler = async (req, res) => {
  sendSuccess(
    res,
    await timeSlotService.deactivate(paramId(req), auditContextFrom(req)),
  );
};

/** Nested under /campaigns/:campaignId/time-slots — for GET (list) only. */
export const campaignTimeSlotRoutes = Router();
campaignTimeSlotRoutes.get(
  '/:campaignId/time-slots',
  requireAuth,
  requirePermission('timeslot.read'),
  listForCampaign,
);
campaignTimeSlotRoutes.post(
  '/:campaignId/time-slots',
  requireAuth,
  requirePermission('timeslot.create'),
  createForCampaign,
);

/** Flat /time-slots/:id — for single-resource read/update/deactivate. */
export const timeSlotRoutes = Router();
timeSlotRoutes.get(
  '/:id',
  requireAuth,
  requirePermission('timeslot.read'),
  getById,
);
timeSlotRoutes.patch(
  '/:id',
  requireAuth,
  requirePermission('timeslot.update'),
  update,
);
timeSlotRoutes.post(
  '/:id/deactivate',
  requireAuth,
  requirePermission('timeslot.deactivate'),
  deactivate,
);

import type { RequestHandler } from 'express';
import { Router } from 'express';
import { paramId } from '../../common/helpers/http';
import { sendCreated, sendSuccess } from '../../common/helpers/response';
import { requireAuth } from '../../middlewares/auth.middleware';
import { requirePermission } from '../../middlewares/permission.middleware';
import { auditContextFrom } from '../audit-logs/audit.service';
import * as campaign from './campaign.controller';
import { campaignStaffService } from './campaign-staff.service';

export const campaignRoutes = Router();

campaignRoutes.get(
  '/',
  requireAuth,
  requirePermission('campaign.read'),
  campaign.list,
);
campaignRoutes.get(
  '/:id',
  requireAuth,
  requirePermission('campaign.read'),
  campaign.getById,
);
campaignRoutes.post(
  '/',
  requireAuth,
  requirePermission('campaign.create'),
  campaign.create,
);
campaignRoutes.patch(
  '/:id',
  requireAuth,
  requirePermission('campaign.update'),
  campaign.update,
);
campaignRoutes.post(
  '/:id/open',
  requireAuth,
  requirePermission('campaign.open'),
  campaign.open,
);
campaignRoutes.post(
  '/:id/close',
  requireAuth,
  requirePermission('campaign.close'),
  campaign.close,
);
campaignRoutes.post(
  '/:id/cancel',
  requireAuth,
  requirePermission('campaign.cancel'),
  campaign.cancel,
);

// Campaign staff roster — not yet in docs/api/frontend-contract.md, same as
// the auth-phase gap pattern: implemented per design, PM confirmation pending.
const listStaff: RequestHandler = async (req, res) => {
  sendSuccess(res, await campaignStaffService.list(paramId(req)));
};
const assignStaff: RequestHandler = async (req, res) => {
  sendCreated(
    res,
    await campaignStaffService.assign(
      paramId(req),
      req.body,
      auditContextFrom(req),
    ),
  );
};
const removeStaff: RequestHandler = async (req, res) => {
  await campaignStaffService.remove(
    paramId(req),
    paramId(req, 'userId'),
    auditContextFrom(req),
  );
  sendSuccess(res, {});
};

campaignRoutes.get(
  '/:id/staff',
  requireAuth,
  requirePermission('campaign_staff.read'),
  listStaff,
);
campaignRoutes.post(
  '/:id/staff',
  requireAuth,
  requirePermission('campaign_staff.assign'),
  assignStaff,
);
campaignRoutes.delete(
  '/:id/staff/:userId',
  requireAuth,
  requirePermission('campaign_staff.remove'),
  removeStaff,
);

import type { RequestHandler } from 'express';
import { Router } from 'express';
import { AppError } from '../../common/errors/app.error';
import { paramId } from '../../common/helpers/http';
import { sendCreated, sendList, sendSuccess } from '../../common/helpers/response';
import { requireAuth } from '../../middlewares/auth.middleware';
import { requirePermission } from '../../middlewares/permission.middleware';
import { auditContextFrom } from '../audit-logs/audit.service';
import { bloodBagService } from './blood-bag.service';

const recordCollection: RequestHandler = async (req, res) => {
  if (!req.auth) throw AppError.unauthorized();
  sendCreated(
    res,
    await bloodBagService.recordCollection(
      paramId(req, 'screeningId'),
      req.body,
      req.auth.userId,
      auditContextFrom(req),
    ),
  );
};

const list: RequestHandler = async (req, res) => {
  const { items, meta } = await bloodBagService.list(req.query);
  sendList(res, items, meta.page, meta.limit, meta.total);
};

const eligibleQueue: RequestHandler = async (req, res) => {
  const campaignId = typeof req.query.campaignId === 'string' ? req.query.campaignId : undefined;
  sendSuccess(res, await bloodBagService.eligibleQueue(campaignId));
};

const getById: RequestHandler = async (req, res) => {
  sendSuccess(res, await bloodBagService.getById(paramId(req)));
};

const update: RequestHandler = async (req, res) => {
  sendSuccess(
    res,
    await bloodBagService.update(
      paramId(req),
      req.body,
      auditContextFrom(req),
    ),
  );
};

const remove: RequestHandler = async (req, res) => {
  sendSuccess(
    res,
    await bloodBagService.delete(paramId(req), auditContextFrom(req)),
  );
};

export const bloodBagRoutes = Router();
// bloodbag.create + certificate.issue are both DONATION_STAFF-only (see
// ROLE_PERMISSIONS), so gating on bloodbag.create alone is sufficient.
bloodBagRoutes.post(
  '/screenings/:screeningId/blood-bags',
  requireAuth,
  requirePermission('bloodbag.create'),
  recordCollection,
);

bloodBagRoutes.get(
  '/blood-bags',
  requireAuth,
  requirePermission('bloodbag.read'),
  list,
);

bloodBagRoutes.get(
  '/blood-bags/eligible',
  requireAuth,
  requirePermission('bloodbag.read'),
  eligibleQueue,
);

bloodBagRoutes.get(
  '/blood-bags/:id',
  requireAuth,
  requirePermission('bloodbag.read'),
  getById,
);

bloodBagRoutes.patch(
  '/blood-bags/:id',
  requireAuth,
  requirePermission('bloodbag.update_status'),
  update,
);

bloodBagRoutes.delete(
  '/blood-bags/:id',
  requireAuth,
  requirePermission('bloodbag.create'),
  remove,
);

import type { RequestHandler } from 'express';
import { Router } from 'express';
import { AppError } from '../../common/errors/app.error';
import { paramId } from '../../common/helpers/http';
import { sendCreated } from '../../common/helpers/response';
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

export const bloodBagRoutes = Router();
// bloodbag.create + certificate.issue are both DONATION_STAFF-only (see
// ROLE_PERMISSIONS), so gating on bloodbag.create alone is sufficient.
bloodBagRoutes.post(
  '/screenings/:screeningId/blood-bags',
  requireAuth,
  requirePermission('bloodbag.create'),
  recordCollection,
);

import type { RequestHandler } from 'express';
import { Router } from 'express';
import { AppError } from '../../common/errors/app.error';
import { paramId } from '../../common/helpers/http';
import { sendList, sendSuccess } from '../../common/helpers/response';
import { requireAuth } from '../../middlewares/auth.middleware';
import { requirePermission } from '../../middlewares/permission.middleware';
import { auditContextFrom } from '../audit-logs/audit.service';
import { certificateService } from './certificate.service';

const attachFile: RequestHandler = async (req, res) => {
  sendSuccess(
    res,
    await certificateService.attachFile(
      paramId(req),
      req.body,
      auditContextFrom(req),
    ),
  );
};

const list: RequestHandler = async (req, res) => {
  if (!req.auth) throw AppError.unauthorized();
  // DONOR can only ever see their own, regardless of what the query asks for.
  const donorOnly = !req.auth.roles.some((r) => r !== 'DONOR');
  const query = donorOnly
    ? { ...req.query, donorUserId: req.auth.userId }
    : req.query;
  const { items, meta } = await certificateService.list(query);
  sendList(res, items, meta.page, meta.limit, meta.total);
};

const revoke: RequestHandler = async (req, res) => {
  sendSuccess(
    res,
    await certificateService.revoke(
      paramId(req),
      req.body,
      auditContextFrom(req),
    ),
  );
};

export const certificateRoutes = Router();
certificateRoutes.get(
  '/',
  requireAuth,
  requirePermission('certificate.read'),
  list,
);
certificateRoutes.post(
  '/:id/file',
  requireAuth,
  requirePermission('certificate.issue'),
  attachFile,
);
certificateRoutes.post(
  '/:id/revoke',
  requireAuth,
  requirePermission('certificate.revoke'),
  revoke,
);

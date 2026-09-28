import type { RequestHandler } from 'express';
import { Router } from 'express';
import { paramId } from '../../common/helpers/http';
import { sendSuccess } from '../../common/helpers/response';
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

export const certificateRoutes = Router();
certificateRoutes.post(
  '/:id/file',
  requireAuth,
  requirePermission('certificate.issue'),
  attachFile,
);

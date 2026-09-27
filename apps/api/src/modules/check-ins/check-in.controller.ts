import type { RequestHandler } from 'express';
import { AppError } from '../../common/errors/app.error';
import { paramId } from '../../common/helpers/http';
import { sendCreated, sendSuccess } from '../../common/helpers/response';
import { auditContextFrom } from '../audit-logs/audit.service';
import { checkInService } from './check-in.service';

export const checkIn: RequestHandler = async (req, res) => {
  if (!req.auth) throw AppError.unauthorized();
  sendCreated(
    res,
    await checkInService.checkIn(
      paramId(req),
      req.auth.userId,
      auditContextFrom(req),
    ),
  );
};

export const markNoShow: RequestHandler = async (req, res) => {
  sendSuccess(
    res,
    await checkInService.markNoShow(paramId(req), auditContextFrom(req)),
  );
};

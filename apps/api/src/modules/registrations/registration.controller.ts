import type { RequestHandler } from 'express';
import { AppError } from '../../common/errors/app.error';
import { paramId } from '../../common/helpers/http';
import { sendCreated, sendSuccess } from '../../common/helpers/response';
import { auditContextFrom } from '../audit-logs/audit.service';
import { registrationService } from './registration.service';

export const create: RequestHandler = async (req, res) => {
  if (!req.auth) throw AppError.unauthorized();
  sendCreated(
    res,
    await registrationService.create(
      req.auth.userId,
      req.body,
      auditContextFrom(req),
    ),
  );
};

export const getById: RequestHandler = async (req, res) => {
  if (!req.auth) throw AppError.unauthorized();
  sendSuccess(res, await registrationService.getById(paramId(req), req.auth));
};

export const reschedule: RequestHandler = async (req, res) => {
  const { timeSlotId } = req.body as { timeSlotId: string };
  sendSuccess(
    res,
    await registrationService.reschedule(
      paramId(req),
      timeSlotId,
      auditContextFrom(req),
    ),
  );
};

export const cancel: RequestHandler = async (req, res) => {
  const { reason } = (req.body ?? {}) as { reason?: string };
  sendSuccess(
    res,
    await registrationService.cancel(
      paramId(req),
      reason,
      auditContextFrom(req),
    ),
  );
};

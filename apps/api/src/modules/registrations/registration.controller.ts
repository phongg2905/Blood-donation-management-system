import type { RequestHandler } from 'express';
import { AppError } from '../../common/errors/app.error';
import { paramId } from '../../common/helpers/http';
import {
  sendCreated,
  sendList,
  sendSuccess,
} from '../../common/helpers/response';
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

export const search: RequestHandler = async (req, res) => {
  if (!req.auth || !req.auth.roles.some((r) => r !== 'DONOR'))
    throw AppError.forbidden();
  const { items, meta } = await registrationService.search(req.query);
  sendList(res, items, meta.page, meta.limit, meta.total);
};

export const my: RequestHandler = async (req, res) => {
  if (!req.auth) throw AppError.unauthorized();
  const { items, meta } = await registrationService.my(
    req.auth.userId,
    req.query,
  );
  sendList(res, items, meta.page, meta.limit, meta.total);
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

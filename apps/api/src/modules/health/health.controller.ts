import type { RequestHandler } from 'express';
import { ERROR_CODES } from '@blood/shared-types';
import { failureResponse, sendSuccess } from '../../common/helpers/response';
import { healthService } from './health.service';

export const getHealth: RequestHandler = async (_req, res) => {
  try {
    sendSuccess(res, await healthService.check());
  } catch {
    // Do not leak database diagnostics; the code is what clients branch on.
    res.status(503).json(failureResponse(ERROR_CODES.DATABASE_UNAVAILABLE));
  }
};

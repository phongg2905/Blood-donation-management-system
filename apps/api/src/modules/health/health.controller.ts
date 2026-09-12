import type { RequestHandler } from 'express';
import { healthService } from './health.service';
export const getHealth: RequestHandler = async (_req, res) => {
  const result = await healthService.check();
  res.status(result.success ? 200 : 503).json(result);
};

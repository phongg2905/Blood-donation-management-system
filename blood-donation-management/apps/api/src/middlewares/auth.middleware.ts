import type { RequestHandler } from 'express';
import { AppError } from '../common/errors/app.error';
// A future verified authentication adapter must populate req.auth.
// Never trust a user id or role supplied directly in request headers.
export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.auth) throw new AppError('Authentication required', 401);
  next();
};

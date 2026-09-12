import type { RequestHandler } from 'express';
import type { RoleCode } from '@blood/shared-types';
import { AppError } from '../common/errors/app.error';
export const requireRole =
  (...roles: RoleCode[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.auth) throw new AppError('Authentication required', 401);
    if (!roles.some((role) => req.auth?.roles.includes(role))) {
      throw new AppError('Forbidden', 403);
    }
    next();
  };

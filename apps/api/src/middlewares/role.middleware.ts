import type { RequestHandler } from 'express';
import type { RoleCode } from '@blood/shared-types';
import { AppError } from '../common/errors/app.error';

/**
 * Role-based gate. Prefer `requirePermission` for action-level rules; use this
 * only when the rule genuinely depends on the role itself.
 */
export const requireRole =
  (...roles: RoleCode[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.auth) throw AppError.unauthorized();
    if (!roles.some((role) => req.auth?.roles.includes(role))) {
      throw AppError.forbidden();
    }
    next();
  };

import type { RequestHandler } from 'express';
import type { PermissionCode } from '@blood/shared-types';
import { AppError } from '../common/errors/app.error';

/**
 * Action-level authorization. Controllers should check a permission
 * (`requirePermission('campaign.open')`) instead of hard-coding a role.
 * `requireRole` remains available for rare, genuinely role-shaped rules.
 */
export const requirePermission =
  (...permissions: PermissionCode[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.auth) throw AppError.unauthorized();
    const granted = new Set(req.auth.permissions);
    if (!permissions.every((permission) => granted.has(permission))) {
      throw AppError.forbidden();
    }
    next();
  };

/** Requires at least one of the supplied permissions. */
export const requireAnyPermission =
  (...permissions: PermissionCode[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.auth) throw AppError.unauthorized();
    const granted = new Set(req.auth.permissions);
    if (!permissions.some((permission) => granted.has(permission))) {
      throw AppError.forbidden();
    }
    next();
  };

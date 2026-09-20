import type { RequestHandler } from 'express';
import { verifyAccessToken } from '../common/security/jwt';
import { AppError } from '../common/errors/app.error';

/**
 * The verified authentication adapter referenced by `req.auth`'s doc comment.
 * Reads `Authorization: Bearer <token>`, verifies the JWT signature and
 * expiry, and — only then — populates `req.auth` from its claims. Never
 * trust a user id, role or permission supplied directly in request headers;
 * everything on `req.auth` comes from a token this server itself signed.
 *
 * Deliberately does not throw on a missing/invalid token: some routes
 * (`GET /campaigns`, say) may want to behave differently for anonymous vs
 * authenticated callers. Routes that must be authenticated still need
 * `requireAuth` after this.
 */
export const authenticate: RequestHandler = (req, _res, next) => {
  const header = req.get('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  if (token) {
    try {
      const claims = verifyAccessToken(token);
      req.auth = {
        userId: claims.sub,
        roles: claims.roles,
        permissions: claims.permissions,
      };
    } catch {
      // Expired/garbled token — leave req.auth unset; requireAuth rejects it.
    }
  }
  next();
};

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.auth) throw AppError.unauthorized();
  next();
};

/** Requires an authenticated actor; used for ownership-scoped writes. */
export const currentUserId = (req: Express.Request): string => {
  if (!req.auth) throw AppError.unauthorized();
  return req.auth.userId;
};

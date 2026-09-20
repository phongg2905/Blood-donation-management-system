import jwt from 'jsonwebtoken';
import type { PermissionCode, RoleCode } from '@blood/shared-types';
import { authConfig } from '../../config/auth.config';
import { env } from '../../config/env';

/**
 * Two JWTs, two secrets, two purposes:
 *
 * - Access token: short-lived, stateless. Verified on every request without a
 *   database round-trip. Carries the claims `requirePermission`/`requireRole`
 *   read from `req.auth`.
 * - Refresh token: long-lived, opaque to the client but still a signed JWT so
 *   forgery is caught before a database lookup. Its SHA-256 hash is the only
 *   copy persisted (`AuthSession.tokenHash`), so a stolen JWT alone is not
 *   enough — the matching session must also be live and unrevoked.
 *
 * Both secrets are optional at the env layer (Phase 1 could run without
 * them); any attempt to sign or verify without a configured secret fails
 * loudly here instead of silently signing with `undefined`.
 */

export interface AccessTokenClaims {
  sub: string;
  roles: RoleCode[];
  permissions: PermissionCode[];
}

export interface RefreshTokenClaims {
  sub: string;
  sid: string;
}

function requireSecret(secret: string | undefined, name: string): string {
  if (!secret) {
    throw new Error(
      `${name} is not configured; cannot sign or verify Phase 2 tokens`,
    );
  }
  return secret;
}

export function signAccessToken(claims: AccessTokenClaims): string {
  const secret = requireSecret(env.JWT_ACCESS_SECRET, 'JWT_ACCESS_SECRET');
  return jwt.sign(claims, secret, {
    expiresIn: `${authConfig.accessTokenTtlMinutes}m`,
  });
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  const secret = requireSecret(env.JWT_ACCESS_SECRET, 'JWT_ACCESS_SECRET');
  return jwt.verify(token, secret) as AccessTokenClaims & jwt.JwtPayload;
}

export function signRefreshToken(claims: RefreshTokenClaims): string {
  const secret = requireSecret(env.JWT_REFRESH_SECRET, 'JWT_REFRESH_SECRET');
  return jwt.sign(claims, secret, {
    expiresIn: `${authConfig.refreshTokenTtlDays}d`,
  });
}

/** Throws `JsonWebTokenError`/`TokenExpiredError` on a bad or stale token. */
export function verifyRefreshToken(token: string): RefreshTokenClaims {
  const secret = requireSecret(env.JWT_REFRESH_SECRET, 'JWT_REFRESH_SECRET');
  return jwt.verify(token, secret) as RefreshTokenClaims & jwt.JwtPayload;
}

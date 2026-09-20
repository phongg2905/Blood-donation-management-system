import { env } from './env';

/**
 * Phase 1 auth strategy (implemented in Phase 2).
 *
 * - Short-lived JWT access token, sent as `Authorization: Bearer <token>`.
 * - Long-lived refresh token stored in an HttpOnly, Secure, SameSite cookie.
 * - `POST /auth/refresh` rotates the session (one row per AuthSession).
 * - `POST /auth/logout` revokes the session instead of deleting the user.
 * - Only hashes of refresh/reset tokens are persisted (`AuthSession.tokenHash`,
 *   `PasswordResetToken.tokenHash`); passwords use scrypt.
 */
export const authConfig = {
  accessTokenTtlMinutes: env.ACCESS_TOKEN_TTL_MINUTES,
  refreshTokenTtlDays: env.REFRESH_TOKEN_TTL_DAYS,
  resetTokenTtlMinutes: env.RESET_TOKEN_TTL_MINUTES,
  refreshCookieName: 'bd_refresh_token',
  refreshCookie: {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/auth',
    maxAgeMs: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  },
  accessSecretConfigured: Boolean(env.JWT_ACCESS_SECRET),
  refreshSecretConfigured: Boolean(env.JWT_REFRESH_SECRET),
} as const;

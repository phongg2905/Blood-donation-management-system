import { rateLimit } from 'express-rate-limit';
import { ERROR_CODES } from '@blood/shared-types';
import { failureResponse } from '../common/helpers/response';

/**
 * Shared limiter factory. Windows are fixed (not sliding) so restarts and
 * single-process tests behave predictably; per-IP keyed by express `req.ip`.
 *
 * The 429 body uses the standard failure envelope with a stable `code`, so the
 * frontend can branch on `code === 'FORBIDDEN'` plus `status === 429` without
 * parsing the message.
 */
export const createAuthRateLimiter = (
  windowMs: number,
  max: number,
  message: string,
) =>
  rateLimit({
    windowMs,
    limit: max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === 'test',
    handler: (_req, res) => {
      res.status(429).json(
        failureResponse(
          ERROR_CODES.FORBIDDEN,
          message,
        ),
      );
    },
  });

/**
 * Env overrides exist so operations can tune limits without a redeploy.
 * Defaults: login/register 10/15 phút, forgot/reset password 5/15 phút.
 */
const toInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const authRateLimiters = {
  /** Credential endpoints — brute-force protection. */
  credentials: createAuthRateLimiter(
    15 * 60 * 1000,
    toInt(process.env.RATE_LIMIT_LOGIN_MAX, 10),
    'Quá nhiều lần thử đăng ký hoặc đăng nhập. Vui lòng thử lại sau.',
  ),
  /** Password-reset endpoints — email bombing / token guessing protection. */
  passwordReset: createAuthRateLimiter(
    15 * 60 * 1000,
    toInt(process.env.RATE_LIMIT_RESET_MAX, 5),
    'Quá nhiều yêu cầu đặt lại mật khẩu. Vui lòng thử lại sau.',
  ),
} as const;

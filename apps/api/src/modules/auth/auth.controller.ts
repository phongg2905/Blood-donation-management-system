import type { CookieOptions, RequestHandler } from 'express';
import { AppError } from '../../common/errors/app.error';
import { sendCreated, sendSuccess } from '../../common/helpers/response';
import { authConfig } from '../../config/auth.config';
import { authService, type RequestContext } from './auth.service';

const cookieOptions: CookieOptions = {
  httpOnly: authConfig.refreshCookie.httpOnly,
  secure: authConfig.refreshCookie.secure,
  sameSite: authConfig.refreshCookie.sameSite,
  path: authConfig.refreshCookie.path,
};

function contextFrom(req: Parameters<RequestHandler>[0]): RequestContext {
  return {
    ipAddress: req.ip ?? null,
    userAgent: req.get('user-agent') ?? null,
  };
}

function setRefreshCookie(
  res: Parameters<RequestHandler>[1],
  token: string,
): void {
  res.cookie(authConfig.refreshCookieName, token, {
    ...cookieOptions,
    maxAge: authConfig.refreshCookie.maxAgeMs,
  });
}

function clearRefreshCookie(res: Parameters<RequestHandler>[1]): void {
  res.clearCookie(authConfig.refreshCookieName, cookieOptions);
}

/**
 * Not yet listed in `docs/api/frontend-contract.md` — only DONOR
 * self-registration; STAFF/ADMIN accounts are admin-provisioned. Confirm
 * scope with the PM before wiring this route on the FE side.
 */
export const register: RequestHandler = async (req, res) => {
  const { tokens, user } = await authService.register(
    req.body,
    contextFrom(req),
  );
  setRefreshCookie(res, tokens.refreshToken);
  sendCreated(res, { accessToken: tokens.accessToken, user });
};

export const login: RequestHandler = async (req, res) => {
  const { tokens, user } = await authService.login(req.body, contextFrom(req));
  setRefreshCookie(res, tokens.refreshToken);
  sendSuccess(res, { accessToken: tokens.accessToken, user });
};

export const refresh: RequestHandler = async (req, res) => {
  const rawToken = req.cookies?.[authConfig.refreshCookieName] as
    string | undefined;
  const tokens = await authService.refresh(rawToken, contextFrom(req));
  setRefreshCookie(res, tokens.refreshToken);
  sendSuccess(res, { accessToken: tokens.accessToken });
};

export const logout: RequestHandler = async (req, res) => {
  const rawToken = req.cookies?.[authConfig.refreshCookieName] as
    string | undefined;
  await authService.logout(rawToken);
  clearRefreshCookie(res);
  sendSuccess(res, {});
};

/**
 * Not yet listed in `docs/api/frontend-contract.md`. Always answers with the
 * same shape so a client can't distinguish "no such email" from "email
 * sent" — see `authService.forgotPassword`. Outside production the response
 * includes `devResetToken` so the FE can complete the flow without an email
 * service (Phase 8).
 */
export const forgotPassword: RequestHandler = async (req, res) => {
  const { devResetToken } = await authService.forgotPassword(req.body);
  sendSuccess(res, {
    message: 'Nếu email tồn tại, hướng dẫn đặt lại mật khẩu đã được gửi',
    ...(devResetToken ? { devResetToken } : {}),
  });
};

/** Not yet listed in `docs/api/frontend-contract.md` — see forgotPassword. */
export const resetPassword: RequestHandler = async (req, res) => {
  await authService.resetPassword(req.body);
  sendSuccess(res, {});
};

export const getMe: RequestHandler = async (req, res) => {
  if (!req.auth) throw AppError.unauthorized();
  sendSuccess(res, await authService.getMe(req.auth.userId));
};

export const updateMe: RequestHandler = async (req, res) => {
  if (!req.auth) throw AppError.unauthorized();
  sendSuccess(res, await authService.updateMe(req.auth.userId, req.body));
};

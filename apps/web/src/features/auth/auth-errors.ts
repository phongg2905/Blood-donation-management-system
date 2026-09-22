import type { ApiFieldErrors } from '@blood/shared-types';
import { ApiNetworkError, ApiRequestError } from '@/services/api';

/**
 * FE-facing view of an auth failure. The UI branches on `code` and uses
 * `message` only for display — the same rule as the rest of the app.
 */
export interface AuthErrorView {
  code: string;
  message: string;
  fields: ApiFieldErrors | null;
}

/**
 * Codes the auth screens react to.
 *
 * `UNAUTHENTICATED` / `FORBIDDEN` / `VALIDATION_ERROR` come from `ERROR_CODES`
 * in `@blood/shared-types`. The credential-specific codes below are **not** in
 * the shared catalogue yet: Phase 1 lists `UNAUTHENTICATED` for a failed login
 * and does not define a register or reset-password endpoint at all, so these are
 * FE-side semantics the mock adapter emits. They are listed in
 * `apps/web/TASK_UNTIL_AUTH_INTEGRATED.md` to be reconciled with the real
 * endpoints. The UI maps both spellings, so no screen breaks either way.
 */
export const AUTH_ERROR_CODES = {
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  ACCOUNT_INACTIVE: 'ACCOUNT_INACTIVE',
  EMAIL_ALREADY_EXISTS: 'EMAIL_ALREADY_EXISTS',
  RESET_TOKEN_INVALID: 'RESET_TOKEN_INVALID',
  RESET_TOKEN_EXPIRED: 'RESET_TOKEN_EXPIRED',
  NETWORK_ERROR: 'NETWORK_ERROR',
  UNKNOWN: 'UNKNOWN',
} as const;
export type AuthErrorCode =
  (typeof AUTH_ERROR_CODES)[keyof typeof AUTH_ERROR_CODES];

const MESSAGES: Readonly<Record<string, string>> = {
  AUTH_ACCOUNT_INACTIVE:
    'Tài khoản đã bị vô hiệu hoá. Vui lòng liên hệ quản trị viên.',
  AUTH_EMAIL_EXISTS: 'Email này đã được đăng ký.',
  AUTH_RESET_TOKEN_INVALID:
    'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.',
  VALIDATION_ERROR: 'Dữ liệu không hợp lệ.',
  UNAUTHENTICATED: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  FORBIDDEN: 'Bạn không có quyền thực hiện thao tác này.',
  ACCOUNT_INACTIVE:
    'Tài khoản đã bị vô hiệu hoá. Vui lòng liên hệ quản trị viên.',
  EMAIL_ALREADY_EXISTS: 'Email này đã được đăng ký.',
  RESET_TOKEN_INVALID: 'Liên kết đặt lại mật khẩu không hợp lệ.',
  RESET_TOKEN_EXPIRED: 'Liên kết đặt lại mật khẩu đã hết hạn.',
  NETWORK_ERROR: 'Không kết nối được máy chủ. Vui lòng thử lại.',
};

/** Login-specific copy: 401 on the login call means "wrong credentials". */
const LOGIN_MESSAGES: Readonly<Record<string, string>> = {
  AUTH_INVALID_CREDENTIALS: 'Email hoặc mật khẩu không đúng.',
  ...MESSAGES,
  UNAUTHENTICATED: 'Email hoặc mật khẩu không đúng.',
  INVALID_CREDENTIALS: 'Email hoặc mật khẩu không đúng.',
};

/** Turns any thrown value into something a screen can render. */
export function describeAuthError(
  error: unknown,
  messages: Readonly<Record<string, string>> = MESSAGES,
): AuthErrorView {
  if (error instanceof ApiRequestError) {
    return {
      code: error.code,
      message: messages[error.code] ?? error.message,
      fields: error.fields,
    };
  }
  if (error instanceof ApiNetworkError) {
    return {
      code: AUTH_ERROR_CODES.NETWORK_ERROR,
      message:
        messages[AUTH_ERROR_CODES.NETWORK_ERROR] ??
        'Không thể kết nối máy chủ.',
      fields: null,
    };
  }
  return {
    code: AUTH_ERROR_CODES.UNKNOWN,
    message:
      error instanceof Error && error.message
        ? error.message
        : 'Đã xảy ra lỗi không xác định.',
    fields: null,
  };
}

/** `describeAuthError` with login wording for a failed sign-in. */
export const describeLoginError = (error: unknown): AuthErrorView =>
  describeAuthError(error, LOGIN_MESSAGES);

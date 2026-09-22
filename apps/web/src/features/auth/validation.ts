/**
 * Auth form validation.
 *
 * Shared validation (`@blood/shared-validation`) only ships the generic uuid
 * schemas today, so the auth rules live here. They mirror what the API is
 * expected to enforce — changing a rule here without changing the API would let
 * a form pass locally and fail on submit, so both sides must move together.
 */

import type { ApiFieldErrors } from '@blood/shared-types';

export type FieldErrors<T extends string> = Partial<Record<T, string>>;

/**
 * Reads only the fields a form actually owns out of an API `error.fields`
 * payload, so an unexpected key can never leak into form state.
 */
export function pickFieldErrors<T extends string>(
  fields: ApiFieldErrors | null | undefined,
  keys: readonly T[],
): FieldErrors<T> {
  const result: FieldErrors<T> = {};
  if (!fields) return result;
  for (const key of keys) {
    const value = fields[key];
    if (typeof value === 'string') result[key] = value;
  }
  return result;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Password policy.
 *
 * The Phase 1 API has no auth endpoint yet, so no server-side policy exists.
 * Minimum: 8 characters, at least one letter and one digit. Recorded as an open
 * item in `apps/web/TASK_UNTIL_AUTH_INTEGRATED.md`.
 */
export const PASSWORD_MIN_LENGTH = 8;

export interface PasswordRequirement {
  id: string;
  label: string;
  test: (value: string) => boolean;
}

export const PASSWORD_REQUIREMENTS: readonly PasswordRequirement[] = [
  {
    id: 'length',
    label: `Ít nhất ${PASSWORD_MIN_LENGTH} ký tự`,
    test: (value) => value.length >= PASSWORD_MIN_LENGTH,
  },
  {
    id: 'letter',
    label: 'Có ít nhất 1 chữ cái',
    test: (value) => /[A-Za-zÀ-ỹ]/.test(value),
  },
  {
    id: 'digit',
    label: 'Có ít nhất 1 chữ số',
    test: (value) => /\d/.test(value),
  },
];

export const unmetPasswordRequirements = (
  value: string,
): readonly PasswordRequirement[] =>
  PASSWORD_REQUIREMENTS.filter((requirement) => !requirement.test(value));

export const isPasswordStrong = (value: string): boolean =>
  unmetPasswordRequirements(value).length === 0;

export const normalizeEmail = (value: string): string =>
  value.trim().toLowerCase();

function validateEmail(email: string): string | undefined {
  if (!email.trim()) return 'Vui lòng nhập email.';
  if (!EMAIL_PATTERN.test(email.trim())) return 'Email không hợp lệ.';
  return undefined;
}

function validatePassword(password: string): string | undefined {
  if (!password) return 'Vui lòng nhập mật khẩu.';
  const unmet = unmetPasswordRequirements(password);
  if (unmet.length > 0) {
    return `Mật khẩu cần: ${unmet.map((item) => item.label.toLowerCase()).join(', ')}.`;
  }
  return undefined;
}

function validateConfirmPassword(
  password: string,
  confirmPassword: string,
): string | undefined {
  if (!confirmPassword) return 'Vui lòng nhập lại mật khẩu.';
  if (password !== confirmPassword) return 'Mật khẩu nhập lại không khớp.';
  return undefined;
}

/* ---------------------------------------------------------------- Login -- */

export type LoginField = 'email' | 'password';

export interface LoginValues {
  email: string;
  password: string;
}

export function validateLogin(values: LoginValues): FieldErrors<LoginField> {
  const errors: FieldErrors<LoginField> = {};
  const emailError = validateEmail(values.email);
  if (emailError) errors.email = emailError;
  if (!values.password) errors.password = 'Vui lòng nhập mật khẩu.';
  return errors;
}

/* ------------------------------------------------------------- Register -- */

export type RegisterField =
  'fullName' | 'email' | 'password' | 'confirmPassword' | 'acceptTerms';

export interface RegisterValues {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  /** FE-only consent; never sent to the API. */
  acceptTerms: boolean;
}

export function validateRegister(
  values: RegisterValues,
): FieldErrors<RegisterField> {
  const errors: FieldErrors<RegisterField> = {};
  if (!values.fullName.trim()) errors.fullName = 'Vui lòng nhập họ và tên.';
  else if (values.fullName.trim().length < 2)
    errors.fullName = 'Họ và tên quá ngắn.';

  const emailError = validateEmail(values.email);
  if (emailError) errors.email = emailError;

  const passwordError = validatePassword(values.password);
  if (passwordError) errors.password = passwordError;

  const confirmError = validateConfirmPassword(
    values.password,
    values.confirmPassword,
  );
  if (confirmError) errors.confirmPassword = confirmError;

  if (!values.acceptTerms)
    errors.acceptTerms = 'Bạn cần đồng ý với điều khoản sử dụng.';

  return errors;
}

/* ------------------------------------------------------ Forgot password -- */

export type ForgotPasswordField = 'email';

export function validateForgotPassword(values: {
  email: string;
}): FieldErrors<ForgotPasswordField> {
  const errors: FieldErrors<ForgotPasswordField> = {};
  const emailError = validateEmail(values.email);
  if (emailError) errors.email = emailError;
  return errors;
}

/* ------------------------------------------------------- Reset password -- */

export type ResetPasswordField = 'password' | 'confirmPassword';

export function validateResetPassword(values: {
  password: string;
  confirmPassword: string;
}): FieldErrors<ResetPasswordField> {
  const errors: FieldErrors<ResetPasswordField> = {};
  const passwordError = validatePassword(values.password);
  if (passwordError) errors.password = passwordError;
  const confirmError = validateConfirmPassword(
    values.password,
    values.confirmPassword,
  );
  if (confirmError) errors.confirmPassword = confirmError;
  return errors;
}

/* -------------------------------------------------------------- Profile -- */

export type ProfileField = 'fullName';

export function validateProfile(values: {
  fullName: string;
}): FieldErrors<ProfileField> {
  const errors: FieldErrors<ProfileField> = {};
  if (!values.fullName.trim()) errors.fullName = 'Vui lòng nhập họ và tên.';
  else if (values.fullName.trim().length < 2)
    errors.fullName = 'Họ và tên quá ngắn.';
  return errors;
}

export const hasErrors = <T extends string>(errors: FieldErrors<T>): boolean =>
  Object.values(errors).some((value) => typeof value === 'string');

/**
 * Auth form validation.
 *
 * Shared validation (`@blood/shared-validation`) only ships the generic uuid
 * schemas today, so the auth rules live here. Follow the delivered API rules;
 * do not change backend validation to accommodate a frontend form.
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
 * Mirrors the API policy: at least 8 characters, lowercase, uppercase and a
 * digit. Keeping this in sync avoids a form passing locally then failing on
 * submit.
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export interface PasswordRequirement {
  id: string;
  label: string;
  test: (value: string) => boolean;
}

export const PASSWORD_REQUIREMENTS: readonly PasswordRequirement[] = [
  {
    id: 'lowercase',
    label: 'Có ít nhất 1 chữ thường',
    test: (value) => /[a-z]/.test(value),
  },
  {
    id: 'uppercase',
    label: 'Có ít nhất 1 chữ hoa',
    test: (value) => /[A-Z]/.test(value),
  },
  {
    id: 'length',
    label: `Ít nhất ${PASSWORD_MIN_LENGTH} ký tự`,
    test: (value) => value.length >= PASSWORD_MIN_LENGTH,
  },
  {
    id: 'digit',
    label: 'Có ít nhất 1 chữ số',
    test: (value) => /\d/.test(value),
  },
  {
    id: 'max-length',
    label: `Tối đa ${PASSWORD_MAX_LENGTH} ký tự`,
    test: (value) => value.length <= PASSWORD_MAX_LENGTH,
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

function validateFullName(fullName: string): string | undefined {
  if (!fullName.trim()) return 'Vui lòng nhập họ và tên.';
  if (fullName.trim().length > 200)
    return 'Họ và tên không được quá 200 ký tự.';
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

/**
 * BE rules for DONOR contact fields (updateMeSchema). Keeping the mirrors in
 * sync avoids a form passing locally then failing on submit.
 */
export const PHONE_MIN_LENGTH = 8;
export const PHONE_MAX_LENGTH = 20;
export const ADDRESS_MAX_LENGTH = 500;

function validatePhone(phone: string): string | undefined {
  const trimmed = phone.trim();
  if (!trimmed) return 'Vui lòng nhập số điện thoại.';
  if (trimmed.length < PHONE_MIN_LENGTH || trimmed.length > PHONE_MAX_LENGTH)
    return `Số điện thoại phải có ${PHONE_MIN_LENGTH}–${PHONE_MAX_LENGTH} ký tự.`;
  return undefined;
}

function validateAddress(address: string): string | undefined {
  const trimmed = address.trim();
  if (!trimmed) return 'Vui lòng nhập địa chỉ.';
  if (trimmed.length > ADDRESS_MAX_LENGTH)
    return `Địa chỉ không được quá ${ADDRESS_MAX_LENGTH} ký tự.`;
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
  const fullNameError = validateFullName(values.fullName);
  if (fullNameError) errors.fullName = fullNameError;

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

export type ProfileField = 'fullName' | 'phone' | 'address';

export function validateProfile(values: {
  fullName: string;
  /** Contact fields only apply to DONOR accounts; undefined skips them. */
  phone?: string | undefined;
  /** Contact fields only apply to DONOR accounts; undefined skips them. */
  address?: string | undefined;
}): FieldErrors<ProfileField> {
  const errors: FieldErrors<ProfileField> = {};
  const fullNameError = validateFullName(values.fullName);
  if (fullNameError) errors.fullName = fullNameError;

  // Only validate fields the form actually shows/edits: a STAFF/ADMIN profile
  // never sends phone/address, matching the delivered API behaviour.
  if (values.phone !== undefined) {
    const phoneError = validatePhone(values.phone);
    if (phoneError) errors.phone = phoneError;
  }
  if (values.address !== undefined) {
    const addressError = validateAddress(values.address);
    if (addressError) errors.address = addressError;
  }
  return errors;
}

export const hasErrors = <T extends string>(errors: FieldErrors<T>): boolean =>
  Object.values(errors).some((value) => typeof value === 'string');

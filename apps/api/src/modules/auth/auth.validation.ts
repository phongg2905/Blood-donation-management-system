import { z } from 'zod';
import { parseDomain } from '../../common/helpers/domain-validation';

/**
 * Minimum 8 characters, at least one lowercase, one uppercase and one digit.
 * This is application-layer policy (not yet wired to `SystemSetting` /
 * rule-as-data — see decisions.md); tightening it later only needs an edit
 * here.
 */
const passwordSchema = z
  .string()
  .min(8, 'Mật khẩu tối thiểu 8 ký tự')
  .max(128, 'Mật khẩu tối đa 128 ký tự')
  .regex(/[a-z]/, 'Mật khẩu cần ít nhất 1 chữ thường')
  .regex(/[A-Z]/, 'Mật khẩu cần ít nhất 1 chữ hoa')
  .regex(/[0-9]/, 'Mật khẩu cần ít nhất 1 chữ số');

const emailSchema = z.string().trim().toLowerCase().email('Email không hợp lệ');

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  fullName: z.string().trim().min(1).max(200),
  phone: z.string().trim().min(8).max(20).optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;
export const validateRegister = (input: unknown): RegisterInput =>
  parseDomain(registerSchema, input);

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Mật khẩu không được để trống'),
});
export type LoginInput = z.infer<typeof loginSchema>;
export const validateLogin = (input: unknown): LoginInput =>
  parseDomain(loginSchema, input);

export const forgotPasswordSchema = z.object({ email: emailSchema });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export const validateForgotPassword = (input: unknown): ForgotPasswordInput =>
  parseDomain(forgotPasswordSchema, input);

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Thiếu token đặt lại mật khẩu'),
  newPassword: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export const validateResetPassword = (input: unknown): ResetPasswordInput =>
  parseDomain(resetPasswordSchema, input);

export const updateMeSchema = z
  .object({
    fullName: z.string().trim().min(1).max(200).optional(),
    phone: z.string().trim().min(8).max(20).optional(),
    address: z.string().trim().min(1).max(500).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Cần ít nhất một trường để cập nhật',
  });
export type UpdateMeInput = z.infer<typeof updateMeSchema>;
export const validateUpdateMe = (input: unknown): UpdateMeInput =>
  parseDomain(updateMeSchema, input);

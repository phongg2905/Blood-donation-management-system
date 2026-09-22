import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Button,
  FormError,
  FormField,
  PasswordInput,
  StatusMessage,
} from '@/components/ui';
import { AUTH_ERROR_CODES, describeAuthError } from '../auth-errors';
import type { AuthErrorView } from '../auth-errors';
import { AuthCard } from '../components/AuthCard';
import { AuthLayout } from '../components/AuthLayout';
import { PasswordRequirements } from '../components/PasswordRequirements';
import { useAuth } from '../hooks/useAuth';
import { AUTH_ROUTES } from '../routing';
import {
  hasErrors,
  pickFieldErrors,
  validateResetPassword,
} from '../validation';
import type { FieldErrors, ResetPasswordField } from '../validation';

const RESET_FIELDS = ['password', 'confirmPassword'] as const;

type ResetState = 'form' | 'success' | 'token-error';

/**
 * Reset password.
 *
 * Reads the token from the reset link's query string (`?token=…`).
 * The API adapter sends it with `newPassword` as required by the backend.
 */
export function ResetPasswordPage() {
  const { resetPassword } = useAuth();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors<ResetPasswordField>>({});
  const [formError, setFormError] = useState<AuthErrorView | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [state, setState] = useState<ResetState>(
    token ? 'form' : 'token-error',
  );
  const [tokenError, setTokenError] = useState<AuthErrorView | null>(
    token
      ? null
      : {
          code: AUTH_ERROR_CODES.RESET_TOKEN_INVALID,
          message: 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.',
          fields: null,
        },
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const nextErrors = validateResetPassword({ password, confirmPassword });
    setErrors(nextErrors);
    setFormError(null);
    if (hasErrors(nextErrors)) return;

    setSubmitting(true);
    try {
      await resetPassword({ token, password });
      setState('success');
    } catch (error) {
      const described = describeAuthError(error);
      // A dead token is terminal: replace the form instead of retrying it.
      if (
        described.code === AUTH_ERROR_CODES.RESET_TOKEN_INVALID ||
        described.code === AUTH_ERROR_CODES.RESET_TOKEN_EXPIRED ||
        described.code === 'AUTH_RESET_TOKEN_INVALID'
      ) {
        setTokenError(described);
        setState('token-error');
        return;
      }
      setFormError(described);
      setErrors({
        ...pickFieldErrors(described.fields, RESET_FIELDS),
        ...(described.fields?.newPassword
          ? { password: described.fields.newPassword }
          : {}),
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      visualTitle="Đặt lại mật khẩu"
      visualLead="Chọn mật khẩu mới cho tài khoản của bạn. Liên kết đặt lại chỉ dùng được một lần."
      visualBullets={[]}
    >
      <AuthCard
        eyebrow="Đặt lại mật khẩu"
        title="Mật khẩu mới"
        subtitle="Liên kết đặt lại mật khẩu chỉ dùng được một lần."
        footer={
          <div className="auth-card__links">
            <Link to={AUTH_ROUTES.login}>← Quay lại đăng nhập</Link>
            <Link to={AUTH_ROUTES.forgotPassword}>Yêu cầu liên kết mới</Link>
          </div>
        }
      >
        {state === 'success' ? (
          <div className="auth-card__form">
            <StatusMessage tone="success" title="Đặt lại mật khẩu thành công">
              Mật khẩu mới đã được lưu. Bạn có thể đăng nhập bằng mật khẩu vừa
              đặt.
            </StatusMessage>
            {/* Anchors styled as buttons — never nest a button inside a link. */}
            <Link
              className="btn btn--primary btn--block"
              to={AUTH_ROUTES.login}
            >
              Đi tới đăng nhập
            </Link>
          </div>
        ) : state === 'token-error' ? (
          <div className="auth-card__form">
            <FormError
              message={tokenError?.message}
              code={tokenError?.code}
              title="Liên kết không dùng được"
            />
            <Link
              className="btn btn--secondary btn--block"
              to={AUTH_ROUTES.forgotPassword}
            >
              Yêu cầu liên kết mới
            </Link>
          </div>
        ) : (
          <form className="auth-card__form" onSubmit={handleSubmit} noValidate>
            <FormError message={formError?.message} code={formError?.code} />

            <FormField
              id="reset-password"
              label="Mật khẩu mới"
              required
              error={errors.password}
            >
              <PasswordInput
                name="password"
                autoComplete="new-password"
                placeholder="Nhập mật khẩu mới"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={submitting}
              />
            </FormField>

            <PasswordRequirements value={password} />

            <FormField
              id="reset-confirm-password"
              label="Nhập lại mật khẩu mới"
              required
              error={errors.confirmPassword}
            >
              <PasswordInput
                name="confirmPassword"
                autoComplete="new-password"
                placeholder="Nhập lại mật khẩu mới"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                disabled={submitting}
              />
            </FormField>

            <Button
              type="submit"
              block
              isLoading={submitting}
              loadingLabel="Đang cập nhật…"
            >
              Đặt lại mật khẩu
            </Button>
          </form>
        )}
      </AuthCard>
    </AuthLayout>
  );
}

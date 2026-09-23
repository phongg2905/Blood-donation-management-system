import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  Button,
  FormError,
  FormField,
  Input,
  StatusMessage,
} from '@/components/ui';
import { describeAuthError } from '../auth-errors';
import type { AuthErrorView } from '../auth-errors';
import { AuthCard } from '../components/AuthCard';
import { AuthLayout } from '../components/AuthLayout';
import { useAuth } from '../hooks/useAuth';
import { AUTH_ROUTES } from '../routing';
import {
  hasErrors,
  normalizeEmail,
  pickFieldErrors,
  validateForgotPassword,
} from '../validation';
import type { FieldErrors, ForgotPasswordField } from '../validation';

const FORGOT_FIELDS = ['email'] as const;

export function ForgotPasswordPage() {
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<FieldErrors<ForgotPasswordField>>({});
  const [formError, setFormError] = useState<AuthErrorView | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [succeeded, setSucceeded] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const nextErrors = validateForgotPassword({ email });
    setErrors(nextErrors);
    setFormError(null);
    if (hasErrors(nextErrors)) return;

    setSubmitting(true);
    try {
      await forgotPassword({
        email: normalizeEmail(email),
      });
      setSucceeded(true);
    } catch (error) {
      const described = describeAuthError(error);
      setFormError(described);
      setErrors(pickFieldErrors(described.fields, FORGOT_FIELDS));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      visualTitle="Khôi phục mật khẩu"
      visualLead="Chúng tôi sẽ gửi liên kết đặt lại mật khẩu tới email bạn đã đăng ký."
      visualBullets={[]}
    >
      <AuthCard
        eyebrow="Quên mật khẩu"
        title="Đặt lại mật khẩu"
        subtitle="Nhập email đăng ký để nhận liên kết đặt lại mật khẩu."
        footer={
          <div className="auth-card__links">
            <Link to={AUTH_ROUTES.login}>← Quay lại đăng nhập</Link>
            <Link to={AUTH_ROUTES.register}>Đăng ký tài khoản</Link>
          </div>
        }
      >
        {succeeded ? (
          <div className="auth-card__form">
            <StatusMessage tone="success" title="Đã gửi yêu cầu">
              Nếu <strong>{normalizeEmail(email)}</strong> tồn tại trong hệ
              thống, liên kết đặt lại mật khẩu sẽ được gửi tới hộp thư đó. Vui
              lòng kiểm tra cả thư mục spam.
            </StatusMessage>
            {/* Anchor styled as a button — never nest a button inside a link. */}
            <Link
              className="btn btn--secondary btn--block"
              to={AUTH_ROUTES.login}
            >
              Về trang đăng nhập
            </Link>
          </div>
        ) : (
          <form className="auth-card__form" onSubmit={handleSubmit} noValidate>
            <FormError message={formError?.message} />

            <FormField
              id="forgot-email"
              label="Email"
              required
              error={errors.email}
              hint="Liên kết đặt lại mật khẩu chỉ dùng được một lần."
            >
              <Input
                name="email"
                type="email"
                autoComplete="email"
                placeholder="ten@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={submitting}
              />
            </FormField>

            <Button
              type="submit"
              block
              isLoading={submitting}
              loadingLabel="Đang gửi…"
            >
              Gửi liên kết đặt lại
            </Button>
          </form>
        )}
      </AuthCard>
    </AuthLayout>
  );
}

import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { PageLoader } from '@/components/common/PageLoader';
import {
  Button,
  FormError,
  FormField,
  Input,
  PasswordInput,
} from '@/components/ui';
import { describeLoginError } from '../auth-errors';
import type { AuthErrorView } from '../auth-errors';
import { AuthCard } from '../components/AuthCard';
import { AuthLayout } from '../components/AuthLayout';
import { useAuth } from '../hooks/useAuth';
import {
  AUTH_ROUTES,
  emailFromState,
  redirectTargetFromState,
  resolvePostLoginPath,
} from '../routing';
import {
  hasErrors,
  normalizeEmail,
  pickFieldErrors,
  validateLogin,
} from '../validation';
import type { FieldErrors, LoginField } from '../validation';

const LOGIN_FIELDS = ['email', 'password'] as const;

export function LoginPage() {
  const { status, currentUser, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState(() => emailFromState(location.state));
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors<LoginField>>({});
  const [formError, setFormError] = useState<AuthErrorView | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Already signed in? Go straight to the intended destination.
  if (status !== 'loading' && currentUser) {
    return (
      <Navigate
        to={resolvePostLoginPath(
          currentUser,
          redirectTargetFromState(location.state),
        )}
        replace
      />
    );
  }
  if (status === 'loading') {
    return <PageLoader message="Đang tải…" />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const nextErrors = validateLogin({ email, password });
    setErrors(nextErrors);
    setFormError(null);
    if (hasErrors(nextErrors)) return;

    setSubmitting(true);
    try {
      const user = await login({
        email: normalizeEmail(email),
        password,
      });
      // Single source of truth for post-login navigation.
      navigate(
        resolvePostLoginPath(user, redirectTargetFromState(location.state)),
        { replace: true },
      );
    } catch (error) {
      const described = describeLoginError(error);
      setFormError(described);
      setErrors(pickFieldErrors(described.fields, LOGIN_FIELDS));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      visualTitle="Chào mừng trở lại"
      visualLead="Đăng nhập để quản lý đợt hiến máu, theo dõi người hiến và toàn bộ quá trình tiếp nhận."
    >
      <AuthCard
        eyebrow="Đăng nhập"
        title="Đăng nhập hệ thống"
        subtitle="Kết nối cộng đồng hiến máu, trao gửi sự sống."
        footer={
          <div className="auth-card__links">
            <span>Chưa có tài khoản? </span>
            <Link to={AUTH_ROUTES.register}>Tạo tài khoản</Link>
          </div>
        }
      >
        <form className="auth-card__form" onSubmit={handleSubmit} noValidate>
          <FormError message={formError?.message} />

          <FormField
            id="login-email"
            label="Email"
            required
            error={errors.email}
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

          <FormField
            id="login-password"
            label="Mật khẩu"
            labelAction={
              <Link to={AUTH_ROUTES.forgotPassword}>Quên mật khẩu?</Link>
            }
            required
            error={errors.password}
          >
            <PasswordInput
              name="password"
              autoComplete="current-password"
              placeholder="Nhập mật khẩu"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={submitting}
            />
          </FormField>

          <Button
            type="submit"
            block
            isLoading={submitting}
            loadingLabel="Đang đăng nhập…"
          >
            Đăng nhập
          </Button>
        </form>
      </AuthCard>
    </AuthLayout>
  );
}

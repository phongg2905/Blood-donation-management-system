import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { PageLoader } from '@/components/common/PageLoader';
import {
  Button,
  Checkbox,
  FormError,
  FormField,
  Input,
  PasswordInput,
  StatusMessage,
} from '@/components/ui';
import { describeAuthError } from '../auth-errors';
import type { AuthErrorView } from '../auth-errors';
import { AuthCard } from '../components/AuthCard';
import { AuthLayout } from '../components/AuthLayout';
import { PasswordRequirements } from '../components/PasswordRequirements';
import { useAuth } from '../hooks/useAuth';
import { AUTH_ROUTES, resolveLandingPath } from '../routing';
import { getAuthService } from '../services/auth-service.resolver';
import {
  hasErrors,
  normalizeEmail,
  pickFieldErrors,
  validateRegister,
} from '../validation';
import type { FieldErrors, RegisterField } from '../validation';

const REGISTER_FIELDS = [
  'fullName',
  'email',
  'password',
  'confirmPassword',
] as const;

/**
 * Public registration.
 *
 * There is no role selector anywhere on this screen by design: the API creates
 * every public account as a `DONOR`. Staff/admin accounts are provisioned by an
 * ADMIN in a later phase, never through self-registration.
 */
export function RegisterPage() {
  const { status, currentUser } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [errors, setErrors] = useState<FieldErrors<RegisterField>>({});
  const [formError, setFormError] = useState<AuthErrorView | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [succeeded, setSucceeded] = useState(false);

  if (status === 'loading') {
    return <PageLoader message="Đang kiểm tra phiên đăng nhập…" />;
  }
  if (currentUser) {
    return <Navigate to={resolveLandingPath(currentUser)} replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const values = {
      fullName,
      email,
      password,
      confirmPassword,
      acceptTerms,
    };
    const nextErrors = validateRegister(values);
    setErrors(nextErrors);
    setFormError(null);
    if (hasErrors(nextErrors)) return;

    setSubmitting(true);
    try {
      await getAuthService().register({
        fullName: fullName.trim(),
        email: normalizeEmail(email),
        password,
      });
      setSucceeded(true);
    } catch (error) {
      const described = describeAuthError(error);
      setFormError(described);
      setErrors(pickFieldErrors(described.fields, REGISTER_FIELDS));
    } finally {
      setSubmitting(false);
    }
  }

  if (succeeded) {
    return (
      <AuthLayout
        visualTitle="Đăng ký thành công"
        visualLead="Tài khoản người hiến máu của bạn đã được tạo."
        visualBullets={[]}
      >
        <AuthCard
          eyebrow="Đăng ký"
          title="Tài khoản đã được tạo"
          subtitle="Bạn có thể đăng nhập ngay bằng email vừa đăng ký."
          footer={
            <div className="auth-card__links">
              <span>Đã có tài khoản? </span>
              <Link to={AUTH_ROUTES.login}>Đăng nhập</Link>
            </div>
          }
        >
          <StatusMessage tone="success" title="Đăng ký hoàn tất">
            Tài khoản <strong>{normalizeEmail(email)}</strong> đã được tạo với
            vai trò Người hiến máu.
          </StatusMessage>
          <Button
            block
            onClick={() =>
              navigate(AUTH_ROUTES.login, {
                replace: true,
                state: { email: normalizeEmail(email) },
              })
            }
          >
            Đi tới đăng nhập
          </Button>
        </AuthCard>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      visualTitle="Trở thành người hiến máu"
      variant="register"
      visualLead="Tạo tài khoản để đăng ký đợt hiến máu, chọn khung giờ và theo dõi lịch sử hiến máu của bạn."
    >
      <AuthCard
        eyebrow="Đăng ký"
        title="Tạo tài khoản người hiến"
        subtitle="Tài khoản đăng ký công khai luôn có vai trò Người hiến máu."
        footer={
          <div className="auth-card__links">
            <span>Đã có tài khoản? </span>
            <Link to={AUTH_ROUTES.login}>Đăng nhập</Link>
          </div>
        }
      >
        <form className="auth-card__form" onSubmit={handleSubmit} noValidate>
          <FormError message={formError?.message} code={formError?.code} />

          <FormField
            id="register-fullname"
            label="Họ và tên"
            required
            error={errors.fullName}
          >
            <Input
              name="fullName"
              autoComplete="name"
              placeholder="Nguyễn Văn A"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              disabled={submitting}
            />
          </FormField>

          <FormField
            id="register-email"
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
            id="register-password"
            label="Mật khẩu"
            required
            error={errors.password}
          >
            <PasswordInput
              name="password"
              autoComplete="new-password"
              placeholder="Tạo mật khẩu"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={submitting}
            />
          </FormField>

          <PasswordRequirements value={password} />

          <FormField
            id="register-confirm-password"
            label="Nhập lại mật khẩu"
            required
            error={errors.confirmPassword}
          >
            <PasswordInput
              name="confirmPassword"
              autoComplete="new-password"
              placeholder="Nhập lại mật khẩu"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              disabled={submitting}
            />
          </FormField>

          <Checkbox
            id="register-terms"
            checked={acceptTerms}
            onChange={(event) => setAcceptTerms(event.target.checked)}
            disabled={submitting}
            error={errors.acceptTerms}
          >
            Tôi đồng ý với điều khoản sử dụng và chính sách bảo mật thông tin
            sức khỏe.
          </Checkbox>

          <Button
            type="submit"
            block
            isLoading={submitting}
            loadingLabel="Đang tạo tài khoản…"
          >
            Tạo tài khoản
          </Button>

          <p className="auth-card__note">
            Thông tin sức khỏe của bạn chỉ được sử dụng cho mục đích sàng lọc
            hiến máu.
          </p>
        </form>
      </AuthCard>
    </AuthLayout>
  );
}

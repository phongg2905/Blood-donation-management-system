import { useState } from 'react';
import type { FormEvent } from 'react';
import { ROLE_NAMES } from '@blood/shared-types';
import type { CurrentUser } from '@blood/shared-types';
import {
  Button,
  FormError,
  FormField,
  Input,
  StatusMessage,
} from '@/components/ui';
import { describeAuthError } from '@/features/auth/auth-errors';
import { useAuth } from '@/features/auth/hooks/useAuth';
import {
  hasErrors,
  pickFieldErrors,
  validateProfile,
} from '@/features/auth/validation';
import type { FieldErrors, ProfileField } from '@/features/auth/validation';

const PROFILE_FIELDS = ['fullName'] as const;

/** Get user initials for avatar placeholder. */
function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

/** Profile summary with avatar, name, email, and role badges. */
function ProfileSummary({ user }: { user: CurrentUser }) {
  return (
    <div className="profile-summary" aria-label="Thông tin tổng quan">
      <div className="profile-avatar" aria-hidden="true">
        {getInitials(user.fullName)}
      </div>
      <div className="profile-summary__info">
        <h2 className="profile-summary__name">{user.fullName}</h2>
        <p className="profile-summary__email">{user.email}</p>
        <div className="profile-summary__roles">
          {user.roles.map((role) => (
            <span className="chip chip--brand" key={role}>
              {ROLE_NAMES[role]}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Read-only identity / account information block. */
function IdentityPanel({ user }: { user: CurrentUser }) {
  return (
    <section className="panel" aria-labelledby="identity-heading">
      <h3 className="panel__title" id="identity-heading">
        Thông tin tài khoản
      </h3>
      <dl className="detail-list">
        <div className="detail-list__row">
          <dt className="detail-list__label">Email</dt>
          <dd className="detail-list__value">{user.email}</dd>
        </div>
        <div className="detail-list__row">
          <dt className="detail-list__label">Họ và tên</dt>
          <dd className="detail-list__value">{user.fullName}</dd>
        </div>
        <div className="detail-list__row">
          <dt className="detail-list__label">Vai trò</dt>
          <dd className="detail-list__value">
            <span className="chip-row">
              {user.roles.map((role) => (
                <span className="chip chip--brand" key={role}>
                  {ROLE_NAMES[role]}
                </span>
              ))}
            </span>
          </dd>
        </div>
      </dl>
      <p className="panel__hint">
        Email và vai trò chỉ có thể thay đổi bởi quản trị viên.
      </p>
    </section>
  );
}

/** Read-only permission list. */
function PermissionsPanel({ user }: { user: CurrentUser }) {
  return (
    <section className="panel" aria-labelledby="permissions-heading">
      <h3 className="panel__title" id="permissions-heading">
        Quyền được cấp ({user.permissions.length})
      </h3>
      <div className="chip-row">
        {user.permissions.map((permission) => (
          <span className="chip" key={permission}>
            {permission}
          </span>
        ))}
      </div>
      <p className="panel__hint">
        Danh sách này lấy trực tiếp từ phiên đăng nhập và được dùng để ẩn/hiện
        chức năng trên giao diện.
      </p>
    </section>
  );
}

/**
 * Profile editor.
 *
 * `PATCH /auth/me` also accepts `phone`/`address`, but `CurrentUser` does not
 * return them yet, so those inputs stay disabled until the API echoes them back.
 */
function ProfileDetails({ user }: { user: CurrentUser }) {
  const { updateProfile } = useAuth();
  const [fullName, setFullName] = useState(user.fullName);
  const [errors, setErrors] = useState<FieldErrors<ProfileField>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [formErrorCode, setFormErrorCode] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const nextErrors = validateProfile({ fullName });
    setErrors(nextErrors);
    setFormError(null);
    setFormErrorCode(null);
    setSaved(false);
    if (hasErrors(nextErrors)) return;

    setSubmitting(true);
    try {
      await updateProfile({ fullName: fullName.trim() });
      setSaved(true);
    } catch (error) {
      const described = describeAuthError(error);
      setFormError(described.message);
      setFormErrorCode(described.code);
      setErrors(pickFieldErrors(described.fields, PROFILE_FIELDS));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="panel" aria-labelledby="profile-edit-heading">
      <h3 className="panel__title" id="profile-edit-heading">
        Cập nhật thông tin
      </h3>
      <form className="form-stack" onSubmit={handleSubmit} noValidate>
        <FormError message={formError} code={formErrorCode} />
        {saved ? (
          <StatusMessage tone="success">
            Thông tin cá nhân đã được cập nhật.
          </StatusMessage>
        ) : null}

        <FormField
          id="profile-fullname"
          label="Họ và tên"
          required
          error={errors.fullName}
        >
          <Input
            name="fullName"
            autoComplete="name"
            value={fullName}
            onChange={(event) => {
              setFullName(event.target.value);
              setSaved(false);
            }}
            disabled={submitting}
          />
        </FormField>

        <div className="panel__actions">
          <Button type="submit" isLoading={submitting} loadingLabel="Đang lưu…">
            Lưu thay đổi
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setFullName(user.fullName);
              setErrors({});
              setFormError(null);
              setSaved(false);
            }}
            disabled={submitting}
          >
            Hoàn tác
          </Button>
        </div>
      </form>
    </section>
  );
}

/** Authenticated profile screen. */
export function ProfilePage() {
  const { currentUser } = useAuth();

  if (!currentUser) {
    return (
      <StatusMessage tone="warning" title="Chưa có phiên đăng nhập">
        Vui lòng đăng nhập lại để xem thông tin cá nhân.
      </StatusMessage>
    );
  }

  return (
    <>
      <header className="page-header">
        <p className="eyebrow">Tài khoản</p>
        <h1 className="page-header__title">Thông tin cá nhân</h1>
        <p className="page-header__lead">
          Quản lý thông tin nhận diện và xem vai trò, quyền hiện có của bạn.
        </p>
      </header>

      <div className="profile-layout">
        <ProfileSummary user={currentUser} />

        <div className="profile-grid">
          <IdentityPanel user={currentUser} />
          <PermissionsPanel user={currentUser} />
          {/* Keyed by id so switching account never shows stale draft values. */}
          <ProfileDetails key={currentUser.id} user={currentUser} />
        </div>
      </div>
    </>
  );
}

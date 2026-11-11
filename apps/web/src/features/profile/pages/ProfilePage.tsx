import { useLayoutEffect, useRef, useState } from 'react';
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
import './profile.css';

const PROFILE_FIELDS = ['fullName', 'phone', 'address'] as const;

function ProfileEditor({
  user,
  onCancel,
  onSaved,
}: {
  user: CurrentUser;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const { updateProfile } = useAuth();
  const [fullName, setFullName] = useState(user.fullName);
  const [phone, setPhone] = useState(user.phone ?? '');
  const [address, setAddress] = useState(user.address ?? '');
  const [errors, setErrors] = useState<FieldErrors<ProfileField>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useLayoutEffect(() => {
    nameRef.current?.focus();
  }, []);
  useLayoutEffect(() => {
    if (hasErrors(errors))
      formRef.current
        ?.querySelector<HTMLInputElement>('[aria-invalid="true"]')
        ?.focus();
  }, [errors]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const values = {
      fullName: fullName.trim(),
      phone: phone.trim(),
      address: address.trim(),
    };
    const nextErrors = validateProfile(values);
    setErrors(nextErrors);
    setFormError(null);
    if (hasErrors(nextErrors)) return;
    setSubmitting(true);
    try {
      await updateProfile(values);
      onSaved();
    } catch (error) {
      const described = describeAuthError(error);
      setFormError(described.message);
      setErrors(pickFieldErrors(described.fields, PROFILE_FIELDS));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="profile-detail-card" aria-labelledby="profile-edit-heading">
      <h2 className="profile-detail-card__heading" id="profile-edit-heading">
        Chỉnh sửa thông tin
      </h2>
      <form
        ref={formRef}
        className="form-stack"
        onSubmit={handleSubmit}
        noValidate
        aria-busy={submitting}
      >
        <FormError message={formError} />
        <FormField
          id="profile-fullname"
          label="Họ và tên"
          required
          error={errors.fullName}
        >
          <Input
            ref={nameRef}
            name="fullName"
            autoComplete="name"
            maxLength={200}
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            disabled={submitting}
          />
        </FormField>
        <FormField
          id="profile-email"
          label="Email"
        >
          <Input name="email" type="email" value={user.email} readOnly />
        </FormField>
        <FormField
          id="profile-citizenid"
          label="Số CCCD"
        >
          <Input
            name="citizenId"
            value={user.citizenId ?? 'Chưa cập nhật'}
            readOnly
          />
        </FormField>
        <FormField
          id="profile-phone"
          label="Số điện thoại"
          required
          error={errors.phone}
        >
          <Input
            name="phone"
            type="tel"
            autoComplete="tel"
            maxLength={20}
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            disabled={submitting}
          />
        </FormField>
        <FormField
          id="profile-address"
          label="Địa chỉ"
          required
          error={errors.address}
        >
          <Input
            name="address"
            autoComplete="street-address"
            maxLength={500}
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            disabled={submitting}
          />
        </FormField>
        <div className="panel__actions" style={{ marginTop: '20px' }}>
          <Button type="submit" isLoading={submitting} loadingLabel="Đang lưu…">
            Lưu thay đổi
          </Button>
          <Button variant="secondary" onClick={onCancel} disabled={submitting}>
            Hủy
          </Button>
        </div>
      </form>
    </section>
  );
}

function ProfileContent({ user }: { user: CurrentUser }) {
  const { hasPermission } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const editRef = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  const canEdit = hasPermission('auth.profile.update');

  useLayoutEffect(() => {
    if (!editing && restoreFocus.current) {
      editRef.current?.focus();
      restoreFocus.current = false;
    }
  }, [editing]);

  function closeEditor(success = false) {
    restoreFocus.current = true;
    setEditing(false);
    setSaved(success);
  }

  const initials = user.fullName
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  const isDonor = user.roles.includes('DONOR');
  const primaryRoleLabel = user.roles.map((role) => ROLE_NAMES[role]).join(', ');

  return (
    <div className="profile-page-container">
      <header className="profile-desktop-header">
        <div className="profile-desktop-header__text">
          <h1 className="profile-desktop-header__title">
            Thông tin cá nhân
          </h1>
        </div>
        {canEdit && !editing ? (
          <Button
            ref={editRef}
            variant="secondary"
            onClick={() => {
              setSaved(false);
              setEditing(true);
            }}
          >
            Chỉnh sửa thông tin
          </Button>
        ) : null}
      </header>

      {saved ? (
        <StatusMessage tone="success">
          Thông tin cá nhân đã được cập nhật.
        </StatusMessage>
      ) : null}

      {/* Hero Banner Card - Linda aesthetic */}
      <section className="profile-hero-card" aria-label="Thông tin tổng quan">
        <div className="profile-hero-card__content">
          <div className="profile-hero-card__badge-row">
            {user.roles.map((role) => (
              <span className="profile-role-pill" key={role}>
                {ROLE_NAMES[role]}
              </span>
            ))}
          </div>
          <h2 className="profile-hero-card__name">{user.fullName}</h2>
          <p className="profile-hero-card__email">{user.email}</p>
          <div className="profile-hero-card__status">
            <span className="profile-hero-card__status-dot" aria-hidden="true" />
            <span>Tài khoản đang hoạt động</span>
          </div>
        </div>

        {/* Concentric Halo Avatar */}
        <div className="profile-avatar-halo-wrap" aria-hidden="true">
          <div className="profile-avatar-halo-outer" />
          <div className="profile-avatar-halo-middle" />
          <div className="profile-avatar-inner">{initials}</div>
        </div>
      </section>

      {/* Quick Summary Cards (3 cards row) */}
      <section className="profile-quick-grid" aria-label="Tóm tắt nhanh">
        <div className="profile-quick-card">
          <span className="profile-quick-card__label">Vai trò</span>
          <span className="profile-quick-card__value" title={primaryRoleLabel}>
            {primaryRoleLabel}
          </span>
        </div>
        <div className="profile-quick-card">
          <span className="profile-quick-card__label">Số CCCD</span>
          <span
            className={`profile-quick-card__value ${
              user.citizenId ? 'profile-quick-card__value--highlight' : ''
            }`}
          >
            {user.citizenId || 'Chưa cập nhật'}
          </span>
        </div>
        <div className="profile-quick-card">
          <span className="profile-quick-card__label">Số điện thoại</span>
          <span className="profile-quick-card__value">
            {user.phone || 'Chưa cập nhật'}
          </span>
        </div>
      </section>

      {/* Main Details / Editor Card */}
      {editing && canEdit ? (
        <ProfileEditor
          user={user}
          onCancel={() => closeEditor()}
          onSaved={() => closeEditor(true)}
        />
      ) : (
        <section className="profile-detail-card" aria-labelledby="identity-heading">
          <h2 className="profile-detail-card__heading" id="identity-heading">
            Thông tin chi tiết
          </h2>
          <div className="profile-facts-grid">
            <div className="profile-fact-item">
              <span className="profile-fact-item__label">Họ và tên</span>
              <span className="profile-fact-item__value">{user.fullName}</span>
            </div>

            <div className="profile-fact-item">
              <span className="profile-fact-item__label">Số CCCD (12 chữ số)</span>
              <span className="profile-fact-item__value profile-fact-item__value--citizen">
                {user.citizenId || 'Chưa cập nhật'}
              </span>
            </div>

            <div className="profile-fact-item">
              <span className="profile-fact-item__label">Địa chỉ Email</span>
              <span className="profile-fact-item__value">{user.email}</span>
            </div>

            <div className="profile-fact-item">
              <span className="profile-fact-item__label">Số điện thoại</span>
              <span className="profile-fact-item__value">
                {user.phone || 'Chưa cập nhật'}
              </span>
            </div>

            <div className="profile-fact-item">
              <span className="profile-fact-item__label">Địa chỉ thường trú</span>
              <span className="profile-fact-item__value">
                {user.address || 'Chưa cập nhật'}
              </span>
            </div>

            <div className="profile-fact-item">
              <span className="profile-fact-item__label">Vai trò hệ thống</span>
              <span className="profile-fact-item__value">{primaryRoleLabel}</span>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

export function ProfilePage() {
  const { currentUser } = useAuth();
  return currentUser ? (
    <ProfileContent key={currentUser.id} user={currentUser} />
  ) : null;
}

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
  // Contact fields belong to DonorProfile; other accounts must not send them.
  const editContacts = user.roles.includes('DONOR');
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
      ...(editContacts ? { phone: phone.trim(), address: address.trim() } : {}),
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
    <section className="panel" aria-labelledby="profile-edit-heading">
      <h2 className="panel__title" id="profile-edit-heading">
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
          hint="Email được dùng để đăng nhập và không thể sửa tại đây."
        >
          <Input name="email" type="email" value={user.email} readOnly />
        </FormField>
        {editContacts ? (
          <>
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
          </>
        ) : null}
        <div className="panel__actions">
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

  const details = [
    ['Họ và tên', user.fullName],
    ['Email', user.email],
    ...(user.roles.includes('DONOR')
      ? [
          ['Số điện thoại', user.phone || 'Chưa cập nhật'],
          ['Địa chỉ', user.address || 'Chưa cập nhật'],
        ]
      : []),
  ];
  const initials = user.fullName
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return (
    <div className="profile-page">
      <header className="page-header profile-header">
        <div>
          <p className="eyebrow">Tài khoản của bạn</p>
          <h1 className="page-header__title">Thông tin cá nhân</h1>
          <p className="page-header__lead">
            Một chút thông tin để kết nối và đồng hành cùng bạn.
          </p>
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
      <div className="profile-layout">
        {saved ? (
          <StatusMessage tone="success">
            Thông tin cá nhân đã được cập nhật.
          </StatusMessage>
        ) : null}
        <section className="profile-summary" aria-label="Thông tin tổng quan">
          <div className="profile-avatar" aria-hidden="true">
            {initials}
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
        </section>
        {editing && canEdit ? (
          <ProfileEditor
            user={user}
            onCancel={() => closeEditor()}
            onSaved={() => closeEditor(true)}
          />
        ) : (
          <section className="panel" aria-labelledby="identity-heading">
            <h2 className="panel__title" id="identity-heading">
              Thông tin liên hệ
            </h2>
            <dl className="detail-list profile-details">
              {details.map(([label, value]) => (
                <div className="detail-list__row" key={label}>
                  <dt className="detail-list__label">{label}</dt>
                  <dd className="detail-list__value">{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}
      </div>
    </div>
  );
}

export function ProfilePage() {
  const { currentUser } = useAuth();
  return currentUser ? (
    <ProfileContent key={currentUser.id} user={currentUser} />
  ) : null;
}

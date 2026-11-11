import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Lock, Shield, UserCheck, Users } from 'lucide-react';
import { ACTOR_CODES, ROLE_NAMES, type ActorCode } from '@blood/shared-types';
import { Button, FormField, Input } from '@/components/ui';
import { Feedback, QueryState } from '@/features/campaigns/components';
import { useAuth } from '@/features/auth/hooks/useAuth';
import {
  AdminBadge,
  AdminDialog,
  AdminPagination,
  AdminShell,
} from './components';
import { formatDateTime, validateUserUpdate } from './domain';
import { useAdminMutation, useAdminQuery } from './hooks';
import { useAdminRepository } from './repository';
import type { AdminUser, AdminUserQuery } from './types';

const PAGE_SIZE = 15;

const GENDER_LABELS: Record<string, string> = {
  MALE: 'Nam',
  FEMALE: 'Nữ',
  OTHER: 'Khác',
};

const BLOOD_TYPE_LABELS: Record<string, string> = {
  A_POS: 'A+',
  A_NEG: 'A-',
  B_POS: 'B+',
  B_NEG: 'B-',
  AB_POS: 'AB+',
  AB_NEG: 'AB-',
  O_POS: 'O+',
  O_NEG: 'O-',
  A_POSITIVE: 'A+',
  A_NEGATIVE: 'A-',
  B_POSITIVE: 'B+',
  B_NEGATIVE: 'B-',
  AB_POSITIVE: 'AB+',
  AB_NEGATIVE: 'AB-',
  O_POSITIVE: 'O+',
  O_NEGATIVE: 'O-',
};

const BLOOD_TYPE_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'O_POSITIVE', label: 'O+' },
  { value: 'O_NEGATIVE', label: 'O-' },
  { value: 'A_POSITIVE', label: 'A+' },
  { value: 'A_NEGATIVE', label: 'A-' },
  { value: 'B_POSITIVE', label: 'B+' },
  { value: 'B_NEGATIVE', label: 'B-' },
  { value: 'AB_POSITIVE', label: 'AB+' },
  { value: 'AB_NEGATIVE', label: 'AB-' },
];

function normalizeBloodTypeValue(raw?: string | null): string {
  if (!raw) return '';
  const map: Record<string, string> = {
    A_POS: 'A_POSITIVE',
    A_NEG: 'A_NEGATIVE',
    B_POS: 'B_POSITIVE',
    B_NEG: 'B_NEGATIVE',
    AB_POS: 'AB_POSITIVE',
    AB_NEG: 'AB_NEGATIVE',
    O_POS: 'O_POSITIVE',
    O_NEG: 'O_NEGATIVE',
  };
  return map[raw] ?? raw;
}

function toInputDate(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

const STATION_LABELS: Record<string, string> = {
  CHECK_IN: 'Tiếp nhận Check-in',
  SCREENING: 'Khám sàng lọc',
  COLLECTION: 'Ghi nhận túi máu',
  SUPPORT: 'Hỗ trợ điều phối',
};

function formatDateOnly(iso?: string | null): string {
  if (!iso) return '—';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parsed);
}

export function UsersPage() {
  const repository = useAdminRepository();
  const { hasPermission } = useAuth();
  const [params, setParams] = useSearchParams();

  const requestedPage = Number(params.get('page'));
  const role = params.get('role');
  const isActiveParam = params.get('isActive');
  const query: AdminUserQuery = {
    page:
      Number.isSafeInteger(requestedPage) && requestedPage > 0
        ? requestedPage
        : 1,
    limit: PAGE_SIZE,
    q: params.get('q') ?? '',
    ...(role && (ACTOR_CODES as readonly string[]).includes(role)
      ? { role: role as ActorCode }
      : {}),
    ...(isActiveParam === 'true' || isActiveParam === 'false'
      ? { isActive: isActiveParam === 'true' }
      : {}),
  };

  const result = useAdminQuery(`users:${params}`, () =>
    repository.users(query),
  );

  const [searchInput, setSearchInput] = useState(params.get('q') ?? '');

  useEffect(() => {
    const current = params.get('q') ?? '';
    if (searchInput !== current) {
      setSearchInput(current);
    }
  }, [params]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const current = params.get('q') ?? '';
      if (searchInput !== current) {
        change('q', searchInput);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const [viewingUser, setViewingUser] = useState<AdminUser | null>(null);

  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftEmail, setDraftEmail] = useState('');
  const [draftPhone, setDraftPhone] = useState('');
  const [draftCitizenId, setDraftCitizenId] = useState('');
  const [draftDob, setDraftDob] = useState('');
  const [draftGender, setDraftGender] = useState('');
  const [draftBloodType, setDraftBloodType] = useState('');
  const [draftAddress, setDraftAddress] = useState('');
  const [draftActive, setDraftActive] = useState(true);
  const [nameError, setNameError] = useState<string | undefined>();
  const editMutation = useAdminMutation();
  const statusMutation = useAdminMutation();

  const [rolesFor, setRolesFor] = useState<AdminUser | null>(null);
  const [draftRoles, setDraftRoles] = useState<ActorCode[]>([]);
  const rolesMutation = useAdminMutation();

  function change(name: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value);
    else next.delete(name);
    if (name !== 'page') next.delete('page');
    setParams(next);
  }

  function openEdit(user: AdminUser) {
    setEditing(user);
    setDraftName(user.fullName);
    setDraftEmail(user.email);
    setDraftPhone(user.donorProfile?.phone ?? '');
    setDraftCitizenId(user.donorProfile?.citizenId ?? '');
    setDraftDob(toInputDate(user.donorProfile?.dateOfBirth));
    setDraftGender(user.donorProfile?.gender ?? '');
    setDraftBloodType(normalizeBloodTypeValue(user.donorProfile?.bloodType));
    setDraftAddress(user.donorProfile?.address ?? '');
    setDraftActive(user.isActive);
    setNameError(undefined);
  }

  function saveEdit() {
    if (!editing) return;
    const errors = validateUserUpdate({ fullName: draftName });
    setNameError(errors.fullName);
    if (errors.fullName) return;
    void editMutation.run(
      () =>
        repository.updateUser(editing.id, {
          fullName: draftName.trim(),
          email: draftEmail.trim() || editing.email,
          isActive: draftActive,
          phone: draftPhone.trim() || null,
          citizenId: draftCitizenId.trim() || null,
          dateOfBirth: draftDob || null,
          gender: draftGender || null,
          bloodType: draftBloodType || null,
          address: draftAddress.trim() || null,
        }),
      (updated) => {
        setEditing(null);
        setViewingUser((prev) =>
          prev && prev.id === updated.id ? { ...prev, ...updated } : prev,
        );
        result.retry();
      },
      'Đã cập nhật tài khoản.',
    );
  }

  function toggleBanUser(user: AdminUser) {
    const nextActive = !user.isActive;
    void statusMutation.run(
      () =>
        repository.updateUser(user.id, {
          isActive: nextActive,
        }),
      (updated) => {
        setViewingUser((prev) =>
          prev && prev.id === updated.id ? { ...prev, ...updated } : prev,
        );
        result.retry();
      },
      nextActive ? 'Đã mở khóa tài khoản.' : 'Đã khóa tài khoản.',
    );
  }

  function openRoles(user: AdminUser) {
    setRolesFor(user);
    setDraftRoles(user.roles[0] ? [user.roles[0]] : ['DONOR']);
  }

  function saveRoles() {
    if (!rolesFor) return;
    void rolesMutation.run(
      () => repository.setUserRoles(rolesFor.id, draftRoles),
      (updated) => {
        setRolesFor(null);
        setViewingUser((prev) =>
          prev && prev.id === updated.id ? { ...prev, ...updated } : prev,
        );
        result.retry();
      },
      'Đã cập nhật vai trò.',
    );
  }

  const totalUsers = result.data?.meta.total ?? 0;
  const activeCount = result.data?.items.filter((u) => u.isActive).length ?? 0;
  const lockedCount = result.data?.items.filter((u) => !u.isActive).length ?? 0;
  const staffCount = result.data?.items.filter((u) => u.roles.some((r) => r !== 'DONOR')).length ?? 0;

  return (
    <AdminShell title="Người dùng">
      {/* 4 Compact Glass KPI Stat Cards */}
      <div className="admin-glass-kpi-grid">
        <div className="admin-glass-kpi-card">
          <div className="admin-kpi-header">
            <span className="admin-kpi-title">Tổng tài khoản</span>
            <span className="admin-kpi-icon-badge" style={{ background: 'rgba(124, 98, 255, 0.14)', color: '#6c52ff' }} aria-hidden="true">
              <Users size={16} />
            </span>
          </div>
          <div className="admin-kpi-value">{totalUsers.toLocaleString('vi-VN')}</div>
          <div className="admin-kpi-trend admin-kpi-trend--up">
            <span>● Toàn hệ thống</span>
          </div>
        </div>

        <div className="admin-glass-kpi-card">
          <div className="admin-kpi-header">
            <span className="admin-kpi-title">Đang hoạt động</span>
            <span className="admin-kpi-icon-badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#059669' }} aria-hidden="true">
              <UserCheck size={16} />
            </span>
          </div>
          <div className="admin-kpi-value">{activeCount}</div>
          <div className="admin-kpi-trend" style={{ color: '#059669' }}>
            <span>Trang hiện tại</span>
          </div>
        </div>

        <div className="admin-glass-kpi-card">
          <div className="admin-kpi-header">
            <span className="admin-kpi-title">Tạm khóa</span>
            <span className="admin-kpi-icon-badge" style={{ background: 'rgba(244, 63, 94, 0.14)', color: '#e11d48' }} aria-hidden="true">
              <Lock size={16} />
            </span>
          </div>
          <div className="admin-kpi-value">{lockedCount}</div>
          <div className="admin-kpi-trend" style={{ color: '#e11d48' }}>
            <span>Cần kiểm tra</span>
          </div>
        </div>

        <div className="admin-glass-kpi-card">
          <div className="admin-kpi-header">
            <span className="admin-kpi-title">Cán bộ & Quản trị</span>
            <span className="admin-kpi-icon-badge" style={{ background: 'rgba(124, 98, 255, 0.15)', color: '#6c52ff' }} aria-hidden="true">
              <Shield size={16} />
            </span>
          </div>
          <div className="admin-kpi-value">{staffCount}</div>
          <div className="admin-kpi-trend admin-kpi-trend--purple">
            <span>Có quyền vận hành</span>
          </div>
        </div>
      </div>

      <form
        className="admin-filters"
        onSubmit={(event) => event.preventDefault()}
      >
        <FormField id="admin-user-q" label="Tìm kiếm">
          <Input
            type="search"
            value={searchInput}
            placeholder="Email hoặc họ tên"
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </FormField>
        <FormField id="admin-user-role" label="Vai trò">
          <select
            className="input"
            id="admin-user-role"
            value={role ?? ''}
            onChange={(event) => change('role', event.target.value)}
          >
            <option value="">Tất cả vai trò</option>
            {ACTOR_CODES.map((code) => (
              <option key={code} value={code}>
                {ROLE_NAMES[code]}
              </option>
            ))}
          </select>
        </FormField>
        <FormField id="admin-user-active" label="Trạng thái">
          <select
            className="input"
            id="admin-user-active"
            value={isActiveParam ?? ''}
            onChange={(event) => change('isActive', event.target.value)}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="true">Đang hoạt động</option>
            <option value="false">Đã khoá</option>
          </select>
        </FormField>
        <div className="admin-filters__action">
          <Button variant="secondary" onClick={() => setParams({})}>
            Xóa bộ lọc
          </Button>
        </div>
      </form>

      {/* The edit/roles dialogs unmount on success, so the confirmation is
          announced from the page instead. */}
      <Feedback
        error={statusMutation.error}
        success={
          editMutation.success || rolesMutation.success || statusMutation.success
        }
      />
      <QueryState {...result} variant="table" columns={5} />
      {result.data && (
        <section className="admin-card">
          {result.data.items.length === 0 ? (
            <p className="admin-empty">Không có tài khoản phù hợp.</p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <caption className="visually-hidden">
                  Danh sách tài khoản hệ thống
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Email</th>
                    <th scope="col">Họ tên</th>
                    <th scope="col">Vai trò</th>
                    <th scope="col">Trạng thái</th>
                    <th scope="col">Đăng nhập gần nhất</th>
                    <th scope="col">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {result.data.items.map((user) => (
                    <tr
                      key={user.id}
                      className="admin-table-row--clickable"
                      onClick={() => setViewingUser(user)}
                    >
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            className="admin-user-avatar"
                            style={{ width: '24px', height: '24px', fontSize: '0.68rem', flexShrink: 0 }}
                            aria-hidden="true"
                          >
                            {user.fullName ? user.fullName.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                          </span>
                          <span>{user.email}</span>
                        </div>
                      </td>
                      <td>{user.fullName}</td>
                      <td>
                        <span className="admin-roles">
                          {user.roles.map((code) => (
                            <AdminBadge
                              key={code}
                              tone={code === 'SYSTEM_ADMIN' || (code as string) === 'ADMIN' ? 'purple' : 'info'}
                            >
                              {ROLE_NAMES[code]}
                            </AdminBadge>
                          ))}
                        </span>
                      </td>
                      <td>
                        <AdminBadge tone={user.isActive ? 'success' : 'danger'}>
                          {user.isActive ? 'Hoạt động' : 'Đã khoá'}
                        </AdminBadge>
                      </td>
                      <td>{formatDateTime(user.lastLoginAt)}</td>
                      <td onClick={(event) => event.stopPropagation()}>
                        <div className="admin-row-actions">
                          {hasPermission('user.manage') && (
                            <Button
                              variant="secondary"
                              onClick={() => openEdit(user)}
                            >
                              Sửa
                            </Button>
                          )}
                          {hasPermission('role.manage') && (
                            <Button
                              variant="ghost"
                              onClick={() => openRoles(user)}
                            >
                              Phân quyền
                            </Button>
                          )}
                          {hasPermission('user.manage') && (
                            <button
                              type="button"
                              className={`admin-ban-btn ${
                                user.isActive
                                  ? 'admin-ban-btn--lock'
                                  : 'admin-ban-btn--unlock'
                              }`}
                              disabled={statusMutation.pending}
                              onClick={() => toggleBanUser(user)}
                            >
                              {user.isActive ? 'Khóa' : 'Mở khóa'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <AdminPagination
            page={result.data.meta.page}
            totalPages={result.data.meta.totalPages}
            total={result.data.meta.total}
            onChange={(page) => change('page', String(page))}
          />
        </section>
      )}

      {viewingUser && !editing && !rolesFor && (
        <div
          className="admin-dialog-backdrop"
          onClick={() => setViewingUser(null)}
        >
          <dialog
            open
            className="admin-dialog admin-user-detail-dialog"
            aria-label={`Chi tiết tài khoản · ${viewingUser.email}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="admin-user-detail-header">
              <div className="admin-user-detail-header__identity">
                <span className="admin-user-avatar admin-user-detail-avatar" aria-hidden="true">
                  {(viewingUser.fullName || viewingUser.email).charAt(0).toUpperCase()}
                </span>
                <div className="admin-user-detail-header__text">
                  <h2>{viewingUser.fullName || 'Chưa cập nhật họ tên'}</h2>
                  <span className="admin-user-detail-email">{viewingUser.email}</span>
                </div>
              </div>
              <div className="admin-user-detail-header__badges">
                {viewingUser.roles.map((code) => (
                  <AdminBadge
                    key={code}
                    tone={code === 'SYSTEM_ADMIN' || (code as string) === 'ADMIN' ? 'purple' : 'info'}
                  >
                    {ROLE_NAMES[code]}
                  </AdminBadge>
                ))}
                <AdminBadge tone={viewingUser.isActive ? 'success' : 'danger'}>
                  {viewingUser.isActive ? 'Hoạt động' : 'Đã khoá'}
                </AdminBadge>
              </div>
            </div>

            <div className="admin-user-detail-grid">
              <div className="admin-user-detail-item">
                <span className="admin-user-detail-label">Ngày tạo tài khoản</span>
                <span className="admin-user-detail-value">
                  {formatDateTime(viewingUser.createdAt)}
                </span>
              </div>
              <div className="admin-user-detail-item">
                <span className="admin-user-detail-label">Đăng nhập gần nhất</span>
                <span className="admin-user-detail-value">
                  {formatDateTime(viewingUser.lastLoginAt)}
                </span>
              </div>
              <div className="admin-user-detail-item">
                <span className="admin-user-detail-label">Số điện thoại</span>
                <span className="admin-user-detail-value">
                  {viewingUser.donorProfile?.phone || '—'}
                </span>
              </div>
              <div className="admin-user-detail-item">
                <span className="admin-user-detail-label">Số CCCD</span>
                <span className="admin-user-detail-value">
                  {viewingUser.donorProfile?.citizenId || '—'}
                </span>
              </div>
              <div className="admin-user-detail-item">
                <span className="admin-user-detail-label">Ngày sinh</span>
                <span className="admin-user-detail-value">
                  {formatDateOnly(viewingUser.donorProfile?.dateOfBirth)}
                </span>
              </div>
              <div className="admin-user-detail-item">
                <span className="admin-user-detail-label">Giới tính / Nhóm máu</span>
                <span className="admin-user-detail-value">
                  {[
                    viewingUser.donorProfile?.gender
                      ? (GENDER_LABELS[viewingUser.donorProfile.gender] ?? viewingUser.donorProfile.gender)
                      : null,
                    viewingUser.donorProfile?.bloodType
                      ? `Nhóm ${BLOOD_TYPE_LABELS[viewingUser.donorProfile.bloodType] ?? viewingUser.donorProfile.bloodType}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ') || '—'}
                </span>
              </div>
              <div className="admin-user-detail-item admin-user-detail-item--full">
                <span className="admin-user-detail-label">Địa chỉ</span>
                <span className="admin-user-detail-value">
                  {viewingUser.donorProfile?.address || '—'}
                </span>
              </div>
            </div>

            {viewingUser.campaignAssignments &&
              viewingUser.campaignAssignments.length > 0 && (
                <div className="admin-user-detail-assignments">
                  <span className="admin-user-detail-label">Đợt hiến máu được phân công</span>
                  <div className="admin-user-detail-assignment-list">
                    {viewingUser.campaignAssignments.map((item) => (
                      <div key={item.id} className="admin-user-detail-assignment-row">
                        <span className="admin-user-detail-assignment-campaign">
                          {item.campaign?.name || 'Đợt hiến máu'}
                        </span>
                        <AdminBadge tone="info">
                          {STATION_LABELS[item.assignment] ?? item.assignment}
                        </AdminBadge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            <div className="admin-actions admin-actions--detail">
              <Button variant="secondary" onClick={() => setViewingUser(null)}>
                Đóng
              </Button>
              <div className="admin-actions__right">
                {hasPermission('user.manage') && (
                  <button
                    type="button"
                    className={`admin-ban-btn admin-ban-btn--dialog ${
                      viewingUser.isActive
                        ? 'admin-ban-btn--lock'
                        : 'admin-ban-btn--unlock'
                    }`}
                    disabled={statusMutation.pending}
                    onClick={() => toggleBanUser(viewingUser)}
                  >
                    {viewingUser.isActive ? 'Khóa tài khoản' : 'Mở khóa'}
                  </button>
                )}
                {hasPermission('user.manage') && (
                  <Button
                    variant="ghost"
                    onClick={() => openEdit(viewingUser)}
                  >
                    Sửa
                  </Button>
                )}
                {hasPermission('role.manage') && (
                  <Button
                    variant="primary"
                    onClick={() => openRoles(viewingUser)}
                  >
                    Phân quyền
                  </Button>
                )}
              </div>
            </div>
          </dialog>
        </div>
      )}

      {editing && (
        <AdminDialog
          title={`Sửa tài khoản · ${editing.email}`}
          pending={editMutation.pending}
          error={editMutation.error}
          onCancel={() => setEditing(null)}
          onConfirm={saveEdit}
        >
          <div className="admin-edit-form-grid">
            <FormField
              id="admin-edit-name"
              label="Họ và tên"
              required
              error={nameError}
            >
              <Input
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
              />
            </FormField>
            <FormField id="admin-edit-email" label="Email" required>
              <Input
                type="email"
                value={draftEmail}
                onChange={(event) => setDraftEmail(event.target.value)}
              />
            </FormField>
            <FormField id="admin-edit-phone" label="Số điện thoại">
              <Input
                type="tel"
                value={draftPhone}
                placeholder="09xxxxxxxx"
                onChange={(event) => setDraftPhone(event.target.value)}
              />
            </FormField>
            <FormField id="admin-edit-citizen-id" label="Số CCCD">
              <Input
                value={draftCitizenId}
                placeholder="12 chữ số"
                onChange={(event) => setDraftCitizenId(event.target.value)}
              />
            </FormField>
            <FormField id="admin-edit-dob" label="Ngày sinh">
              <Input
                type="date"
                value={draftDob}
                onChange={(event) => setDraftDob(event.target.value)}
              />
            </FormField>
            <FormField id="admin-edit-gender" label="Giới tính">
              <select
                id="admin-edit-gender"
                className="input"
                value={draftGender}
                onChange={(event) => setDraftGender(event.target.value)}
              >
                <option value="">Chưa cập nhật</option>
                <option value="MALE">Nam</option>
                <option value="FEMALE">Nữ</option>
                <option value="OTHER">Khác</option>
              </select>
            </FormField>
            <FormField id="admin-edit-blood-type" label="Nhóm máu">
              <select
                id="admin-edit-blood-type"
                className="input"
                value={draftBloodType}
                onChange={(event) => setDraftBloodType(event.target.value)}
              >
                <option value="">Chưa cập nhật</option>
                {BLOOD_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField id="admin-edit-status" label="Trạng thái">
              <select
                id="admin-edit-status"
                className="input"
                value={draftActive ? 'true' : 'false'}
                onChange={(event) =>
                  setDraftActive(event.target.value === 'true')
                }
              >
                <option value="true">Đang hoạt động</option>
                <option value="false">Đã khóa</option>
              </select>
            </FormField>
            <div className="admin-edit-form-grid__full">
              <FormField id="admin-edit-address" label="Địa chỉ">
                <Input
                  value={draftAddress}
                  placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành"
                  onChange={(event) => setDraftAddress(event.target.value)}
                />
              </FormField>
            </div>
          </div>
        </AdminDialog>
      )}

      {rolesFor && (
        <AdminDialog
          title={`Phân quyền · ${rolesFor.email}`}
          pending={rolesMutation.pending}
          error={rolesMutation.error}
          confirmDisabled={draftRoles.length === 0}
          onCancel={() => setRolesFor(null)}
          onConfirm={saveRoles}
        >
          <div className="admin-role-user-banner">
            <div className="admin-role-user-banner__info">
              <span className="admin-role-user-banner__name">
                {rolesFor.fullName || rolesFor.email}
              </span>
              <span className="admin-role-user-banner__email">
                {rolesFor.email}
              </span>
            </div>
            <div className="admin-role-user-banner__current">
              <span className="admin-role-user-banner__label">
                Vai trò hiện tại:
              </span>
              {rolesFor.roles.length > 0 ? (
                <div className="admin-roles">
                  {rolesFor.roles.map((code) => (
                    <AdminBadge
                      key={code}
                      tone={
                        code === 'SYSTEM_ADMIN' || (code as string) === 'ADMIN'
                          ? 'purple'
                          : 'info'
                      }
                    >
                      {ROLE_NAMES[code] ?? code}
                    </AdminBadge>
                  ))}
                </div>
              ) : (
                <AdminBadge tone="warning">Chưa phân quyền</AdminBadge>
              )}
            </div>
          </div>

          <div className="admin-role-choices" role="radiogroup" aria-label="Chọn vai trò">
            {ACTOR_CODES.map((code) => {
              const isChecked = draftRoles[0] === code;
              const isCurrent = rolesFor.roles.includes(code);
              const inputId = `admin-role-${code}`;
              return (
                <label
                  key={code}
                  htmlFor={inputId}
                  className={`admin-role-choice-card ${
                    isChecked ? 'admin-role-choice-card--selected' : ''
                  }`}
                >
                  <div className="admin-role-choice-card__top">
                    <span className="admin-role-choice-card__radio-wrap">
                      <input
                        id={inputId}
                        type="radio"
                        name="admin-user-role-choice"
                        className="admin-role-radio"
                        aria-label={ROLE_NAMES[code]}
                        checked={isChecked}
                        onChange={() => setDraftRoles([code])}
                      />
                      <span className="admin-role-choice-card__title">
                        {ROLE_NAMES[code]}
                      </span>
                    </span>
                    {isCurrent && (
                      <span className="admin-role-choice-card__current-tag">
                        Hiện tại
                      </span>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        </AdminDialog>
      )}
    </AdminShell>
  );
}

import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Lock, Shield, UserCheck, Users } from 'lucide-react';
import { ACTOR_CODES, ROLE_NAMES, type ActorCode } from '@blood/shared-types';
import { Button, Checkbox, FormField, Input } from '@/components/ui';
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

  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftActive, setDraftActive] = useState(true);
  const [nameError, setNameError] = useState<string | undefined>();
  const editMutation = useAdminMutation();

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
          isActive: draftActive,
        }),
      () => {
        setEditing(null);
        result.retry();
      },
      'Đã cập nhật tài khoản.',
    );
  }

  function openRoles(user: AdminUser) {
    setRolesFor(user);
    setDraftRoles([...user.roles]);
  }

  function saveRoles() {
    if (!rolesFor) return;
    void rolesMutation.run(
      () => repository.setUserRoles(rolesFor.id, draftRoles),
      () => {
        setRolesFor(null);
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
            <span className="admin-kpi-icon-badge" style={{ background: 'rgba(0, 240, 255, 0.15)', color: '#00f0ff' }} aria-hidden="true">
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
            <span className="admin-kpi-icon-badge" style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80' }} aria-hidden="true">
              <UserCheck size={16} />
            </span>
          </div>
          <div className="admin-kpi-value">{activeCount}</div>
          <div className="admin-kpi-trend" style={{ color: '#4ade80' }}>
            <span>Trang hiện tại</span>
          </div>
        </div>

        <div className="admin-glass-kpi-card">
          <div className="admin-kpi-header">
            <span className="admin-kpi-title">Tạm khóa</span>
            <span className="admin-kpi-icon-badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171' }} aria-hidden="true">
              <Lock size={16} />
            </span>
          </div>
          <div className="admin-kpi-value">{lockedCount}</div>
          <div className="admin-kpi-trend" style={{ color: '#f87171' }}>
            <span>Cần kiểm tra</span>
          </div>
        </div>

        <div className="admin-glass-kpi-card">
          <div className="admin-kpi-header">
            <span className="admin-kpi-title">Cán bộ & Quản trị</span>
            <span className="admin-kpi-icon-badge" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc' }} aria-hidden="true">
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
        error={null}
        success={editMutation.success || rolesMutation.success}
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
                    <tr key={user.id}>
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
                      <td>
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

      {editing && (
        <AdminDialog
          title={`Sửa tài khoản · ${editing.email}`}
          pending={editMutation.pending}
          error={editMutation.error}
          onCancel={() => setEditing(null)}
          onConfirm={saveEdit}
        >
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
          <Checkbox
            id="admin-edit-active"
            checked={draftActive}
            onChange={(event) => setDraftActive(event.target.checked)}
          >
            Tài khoản đang hoạt động
          </Checkbox>
          <p className="admin-muted">
            Tài khoản bị khoá không thể đăng nhập nhưng dữ liệu vẫn được giữ.
          </p>
        </AdminDialog>
      )}

      {rolesFor && (
        <AdminDialog
          title={`Phân quyền · ${rolesFor.email}`}
          pending={rolesMutation.pending}
          error={rolesMutation.error}
          onCancel={() => setRolesFor(null)}
          onConfirm={saveRoles}
        >
          <div className="admin-role-choices">
            {ACTOR_CODES.map((code) => (
              <Checkbox
                key={code}
                id={`admin-role-${code}`}
                checked={draftRoles.includes(code)}
                onChange={(event) =>
                  setDraftRoles((previous) =>
                    event.target.checked
                      ? [...new Set([...previous, code])]
                      : previous.filter((item) => item !== code),
                  )
                }
              >
                {ROLE_NAMES[code]}
              </Checkbox>
            ))}
          </div>
          {draftRoles.length === 0 && (
            <p className="admin-muted">
              Tài khoản không có vai trò nào sẽ không dùng được hệ thống.
            </p>
          )}
        </AdminDialog>
      )}
    </AdminShell>
  );
}

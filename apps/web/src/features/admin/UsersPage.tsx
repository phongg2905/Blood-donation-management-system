import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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

const PAGE_SIZE = 8;

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

  return (
    <AdminShell
      title="Người dùng"
      lead="Quản lý tài khoản, trạng thái hoạt động và vai trò được cấp."
    >
      <form
        className="admin-filters"
        onSubmit={(event) => event.preventDefault()}
      >
        <FormField id="admin-user-q" label="Tìm kiếm">
          <Input
            type="search"
            value={query.q}
            placeholder="Email hoặc họ tên"
            onChange={(event) => change('q', event.target.value)}
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
          <Button variant="ghost" onClick={() => setParams({})}>
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
      <QueryState {...result} />
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
                      <td>{user.email}</td>
                      <td>{user.fullName}</td>
                      <td>
                        <span className="admin-roles">
                          {user.roles.map((code) => (
                            <AdminBadge key={code} tone="info">
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

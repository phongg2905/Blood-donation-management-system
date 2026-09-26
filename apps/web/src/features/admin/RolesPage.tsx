import { ROLE_NAMES } from '@blood/shared-types';
import { QueryState } from '@/features/campaigns/components';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { AdminBadge, AdminShell } from './components';
import { useAdminQuery } from './hooks';
import { useAdminRepository } from './repository';

export function RolesPage() {
  const repository = useAdminRepository();
  const { hasPermission } = useAuth();

  const roles = useAdminQuery('roles', () => repository.roles());
  const permissions = useAdminQuery('permissions', () =>
    repository.permissions(),
  );

  return (
    <AdminShell
      eyebrow="Quản trị hệ thống"
      title="Vai trò & quyền"
      lead="Bốn vai trò của hệ thống cùng tập quyền tương ứng. Ma trận quyền do backend quy định."
    >
      <section className="admin-card" aria-labelledby="admin-roles-heading">
        <h2 id="admin-roles-heading">Vai trò</h2>
        <QueryState {...roles} />
        <div className="admin-role-grid">
          {roles.data?.map((role) => (
            <article className="admin-role-card" key={role.code}>
              <header>
                <h3>{role.name}</h3>
                <code>{role.code}</code>
              </header>
              <p className="admin-muted">
                {role.userCount} tài khoản · {role.permissions.length} quyền
              </p>
              <ul className="admin-permission-list">
                {role.permissions.map((permission) => (
                  <li key={permission}>
                    <code>{permission}</code>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
        <p className="admin-muted">
          Không có API chỉnh sửa vai trò/quyền trong hợp đồng hiện tại. Thay đổi
          ma trận thuộc backend.
        </p>
      </section>

      {hasPermission('permission.read') && (
        <section
          className="admin-card"
          aria-labelledby="admin-permissions-heading"
        >
          <h2 id="admin-permissions-heading">Danh mục quyền</h2>
          <QueryState {...permissions} />
          {permissions.data && (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <caption className="visually-hidden">
                  Danh mục quyền và vai trò được cấp
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Mã quyền</th>
                    <th scope="col">Vai trò được cấp</th>
                  </tr>
                </thead>
                <tbody>
                  {permissions.data.map((permission) => (
                    <tr key={permission.code}>
                      <td>
                        <code>{permission.code}</code>
                      </td>
                      <td>
                        <span className="admin-roles">
                          {permission.roles.length === 0 ? (
                            <span className="admin-muted">
                              Không vai trò nào
                            </span>
                          ) : (
                            permission.roles.map((role) => (
                              <AdminBadge key={role} tone="neutral">
                                {ROLE_NAMES[role]}
                              </AdminBadge>
                            ))
                          )}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </AdminShell>
  );
}

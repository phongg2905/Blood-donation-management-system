import { useState } from 'react';
import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { ROLE_NAMES } from '@blood/shared-types';
import { Brand } from '@/components/common/Brand';
import { Button } from '@/components/ui';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { visibleNavItems } from '@/features/auth/navigation';
import { AUTH_ROUTES, primaryRole } from '@/features/auth/routing';

export interface AppShellProps {
  children: ReactNode;
  /** Only used for layout-specific styling hooks. */
  variant: 'donor' | 'staff' | 'admin';
}

/**
 * Chrome shared by every role.
 *
 * Navigation is filtered by permission, so a role never sees a link it cannot
 * open. The role itself is used only for display here.
 */
export function AppShell({ children, variant }: AppShellProps) {
  const { currentUser, hasPermission, logout } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  const items = visibleNavItems(hasPermission);
  const role = primaryRole(currentUser?.roles ?? []);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
      navigate(AUTH_ROUTES.login, { replace: true });
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className={`app-shell app-shell--${variant}`}>
      <header className="app-header">
        <div className="app-header__inner">
          <Brand
            to="/"
            tagline={variant === 'admin' ? 'Quản trị' : 'Quản lý hiến máu'}
          />

          <nav className="app-nav" aria-label="Điều hướng chính">
            {items.map((item) => (
              <NavLink className="app-nav__link" key={item.to} to={item.to}>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="session">
            <span className="session__user">
              <span className="session__name">{currentUser?.fullName}</span>
              <span className="session__role">
                {role ? ROLE_NAMES[role] : ''}
              </span>
            </span>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleLogout}
              isLoading={loggingOut}
              loadingLabel="Đang thoát…"
            >
              Đăng xuất
            </Button>
          </div>
        </div>
      </header>

      <main className="app-main">{children}</main>
    </div>
  );
}

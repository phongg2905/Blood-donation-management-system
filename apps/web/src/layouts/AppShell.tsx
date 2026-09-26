import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ROLE_NAMES } from '@blood/shared-types';
import { Brand } from '@/components/common/Brand';
import { Button } from '@/components/ui';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { visibleNavItems } from '@/features/auth/navigation';
import { AUTH_ROUTES, primaryRole } from '@/features/auth/routing';
import { useHeaderAutoHide } from '@/hooks/useHeaderAutoHide';

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
  const { pathname } = useLocation();
  const isHome = pathname === AUTH_ROUTES.home;
  const [loggingOut, setLoggingOut] = useState(false);
  const menuRef = useRef<HTMLDetailsElement>(null);

  const role = primaryRole(currentUser?.roles ?? []);
  const items = visibleNavItems(hasPermission, role);

  // The masthead slides out on the way down and back on the way up.
  useHeaderAutoHide(pathname);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } catch {
      // AuthProvider clears the local session even if the request fails.
    } finally {
      navigate(AUTH_ROUTES.login, { replace: true });
      setLoggingOut(false);
    }
  }

  return (
    <div className={`app-shell app-shell--${variant}${isHome ? ' app-shell--home' : ''}`}>
      <a className="skip-link" href="#main-content">
        Đến nội dung chính
      </a>
      <header className="app-header">
        <div className="app-header__inner">
          <Brand
            inverse={isHome}
            to="/"
            tagline={variant === 'admin' ? 'Quản trị' : 'Quản lý hiến máu'}
          />

          <nav className="app-nav" aria-label="Điều hướng chính">
            {items.map((item) => (
              <NavLink className="app-nav__link" key={item.to} to={item.to} end>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="session">
            <details
              className="account-menu"
              ref={menuRef}
              onKeyDown={(event) => {
                if (event.key === 'Escape' && menuRef.current) {
                  menuRef.current.open = false;
                  menuRef.current.querySelector('summary')?.focus();
                }
              }}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget))
                  event.currentTarget.open = false;
              }}
            >
              <summary aria-label="Tài khoản của bạn">
                <span className="session__avatar" aria-hidden="true">
                  {currentUser?.fullName
                    .trim()
                    .split(/\s+/)
                    .at(-1)
                    ?.slice(0, 1)
                    .toUpperCase()}
                </span>
                <span className="session__user">
                  <span className="session__name">{currentUser?.fullName}</span>
                  <span className="session__role">
                    {role ? ROLE_NAMES[role] : ''}
                  </span>
                </span>
                <span aria-hidden="true">⌄</span>
              </summary>
              <div className="account-menu__panel">
                {hasPermission('auth.profile.read') ? (
                  <Link
                    to="/profile"
                    onClick={() => {
                      if (menuRef.current) menuRef.current.open = false;
                    }}
                  >
                    Hồ sơ cá nhân
                  </Link>
                ) : null}
                <Button
                  variant="ghost"
                  onClick={handleLogout}
                  isLoading={loggingOut}
                  loadingLabel="Đang thoát…"
                >
                  Đăng xuất
                </Button>
              </div>
            </details>
          </div>
        </div>
      </header>

      <main className="app-main" id="main-content" tabIndex={-1}>
        {children}
      </main>
      <footer className="app-footer">
        <span>Blood Donation</span>
        <p>Sẻ chia một phần máu. Trao gửi một niềm hy vọng.</p>
      </footer>
    </div>
  );
}

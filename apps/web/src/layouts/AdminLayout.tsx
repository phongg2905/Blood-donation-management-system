import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ROLE_NAMES } from '@blood/shared-types';
import {
  Droplet,
  Users,
  ShieldCheck,
  FileText,
  Sliders,
  BarChart3,
  Heart,
  LayoutDashboard,
  Search,
  LogOut,
  Bell,
} from 'lucide-react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { visibleNavItems } from '@/features/auth/navigation';
import { AUTH_ROUTES, primaryRole } from '@/features/auth/routing';

export interface AdminLayoutProps {
  children?: ReactNode;
}

const NAV_ICONS: Record<string, typeof Users> = {
  '/admin/users': Users,
  '/admin/roles': ShieldCheck,
  '/admin/audit-logs': FileText,
  '/admin/settings': Sliders,
  '/admin/reports': BarChart3,
  '/campaigns': Heart,
  [AUTH_ROUTES.home]: LayoutDashboard,
};

export function AdminLayout({ children }: AdminLayoutProps) {
  const { currentUser, hasPermission, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [loggingOut, setLoggingOut] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (import.meta.env.MODE !== 'test') {
      window.scrollTo(0, 0);
    }
  }, [pathname]);

  const role = primaryRole(currentUser?.roles ?? []);
  const items = visibleNavItems(hasPermission, role);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } catch {
      // AuthProvider clears session on error
    } finally {
      navigate(AUTH_ROUTES.login, { replace: true });
      setLoggingOut(false);
    }
  }

  // Derive current page title for breadcrumb
  const currentNavItem = items.find((i) => i.to === pathname);
  const breadcrumbCurrent = currentNavItem?.label ?? 'Tổng quan';

  return (
    <div className="admin-portal-layout app-shell--admin">
      <a className="skip-link" href="#main-content">
        Đến nội dung chính
      </a>

      {/* Left Frosted Glass Sidebar */}
      <aside className="admin-glass-sidebar" aria-label="Thanh điều hướng quản trị">
        <div>
          <Link to="/" className="admin-sidebar-brand">
            <span className="admin-brand-icon" aria-hidden="true">
              <Droplet size={18} fill="currentColor" />
            </span>
            <div className="admin-brand-text">
              <span className="admin-brand-title">BloodAdmin</span>
            </div>
          </Link>

          <nav className="admin-sidebar-nav" aria-label="Điều hướng chính">
            {items.map((item) => {
              const Icon = NAV_ICONS[item.to] ?? LayoutDashboard;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === AUTH_ROUTES.home}
                  className={({ isActive }) =>
                    `admin-nav-item${isActive ? ' admin-nav-item--active' : ''}`
                  }
                >
                  <Icon className="admin-nav-icon" aria-hidden="true" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="admin-sidebar-footer">
          <div className="admin-user-pill">
            <span className="admin-user-avatar" aria-hidden="true">
              {currentUser?.fullName?.charAt(0) || 'A'}
            </span>
            <div className="admin-user-info">
              <span className="admin-user-name session__name" title={currentUser?.fullName || currentUser?.email}>
                {currentUser?.fullName || currentUser?.email || 'Quản trị viên'}
              </span>
              <span className="admin-user-role session__role">
                {role ? ROLE_NAMES[role] : 'Quản trị hệ thống'}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="admin-logout-btn"
            onClick={() => void handleLogout()}
            disabled={loggingOut}
          >
            <LogOut size={13} aria-hidden="true" />
            <span>{loggingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top Slim Frosted Glass Header */}
        <header className="admin-glass-header">
          <div className="admin-header-breadcrumbs">
            <Link to="/">Quản trị</Link>
            <span aria-hidden="true">/</span>
            <span>{breadcrumbCurrent}</span>
          </div>

          <div className="admin-header-actions">
            <div className="admin-header-search">
              <Search size={14} aria-hidden="true" />
              <input
                type="search"
                placeholder="Tìm kiếm nhanh..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Tìm kiếm quản trị"
              />
            </div>
            <button
              type="button"
              className="admin-icon-btn"
              title="Thông báo hệ thống"
              aria-label="Thông báo"
            >
              <Bell size={15} />
            </button>
          </div>
        </header>

        {/* Main Canvas */}
        <main id="main-content" className="admin-main-canvas">
          {children ?? <Outlet />}
        </main>
      </div>
    </div>
  );
}

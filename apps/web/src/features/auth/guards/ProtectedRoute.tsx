import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { PageLoader } from '@/components/common/PageLoader';
import { useAuth } from '../hooks/useAuth';
import { AUTH_ROUTES } from '../routing';

export interface ProtectedRouteProps {
  /** Optional explicit children; defaults to the nested route's `<Outlet />`. */
  children?: ReactNode;
}

/**
 * Authentication gate.
 *
 * Handles *authentication only* — authorization belongs to `PermissionGuard`,
 * which is why there is no role check here. While the session is still being
 * restored it renders a loader instead of briefly bouncing to `/login`.
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return <PageLoader message="Đang kiểm tra phiên đăng nhập…" />;
  }

  if (status === 'anonymous') {
    // `from` lets the login screen return the user to the page they wanted.
    return (
      <Navigate
        to={AUTH_ROUTES.login}
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  return <>{children ?? <Outlet />}</>;
}

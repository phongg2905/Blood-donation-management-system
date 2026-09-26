import type { ReactNode } from 'react';
import { useRef } from 'react';
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

  // `from` only makes sense for a cold deep link (arriving at a protected URL
  // while already signed out). Once a session existed in this app instance, a
  // later anonymous state is a sign-out, so the page the user left must not be
  // handed to whoever signs in next — that user may lack the permission and
  // land on /403 instead of their own landing page.
  const hadSession = useRef(false);
  if (status === 'authenticated') hadSession.current = true;

  if (status === 'loading') {
    return <PageLoader message="Đang tải…" />;
  }

  if (status === 'anonymous') {
    return (
      <Navigate
        to={AUTH_ROUTES.login}
        replace
        state={
          hadSession.current
            ? undefined
            : { from: `${location.pathname}${location.search}` }
        }
      />
    );
  }

  return <>{children ?? <Outlet />}</>;
}

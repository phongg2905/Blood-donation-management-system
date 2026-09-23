import type { ReactNode } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import type { PermissionCode } from '@blood/shared-types';
import { PageLoader } from '@/components/common/PageLoader';
import { useAuth } from '../hooks/useAuth';
import { AUTH_ROUTES } from '../routing';

export interface PermissionGuardProps {
  /** Single permission the user must hold. */
  requiredPermission?: PermissionCode;
  /** Passes when the user holds at least one of these. */
  anyOf?: readonly PermissionCode[];
  /** Passes only when the user holds every one of these. */
  allOf?: readonly PermissionCode[];
  /** Render this instead of navigating to /403 (e.g. hide an action). */
  fallback?: ReactNode;
  children?: ReactNode;
}

/**
 * Authorization gate.
 *
 * Decides purely on `CurrentUser.permissions` — never on a role name, so adding
 * or re-scoping a role never requires touching page code. Roles only drive
 * layout and navigation grouping.
 */
export function PermissionGuard({
  requiredPermission,
  anyOf,
  allOf,
  fallback,
  children,
}: PermissionGuardProps) {
  const { status, hasPermission, hasAnyPermission, hasAllPermissions } =
    useAuth();

  if (status === 'loading') {
    return <PageLoader message="Đang tải…" />;
  }
  if (status === 'anonymous') {
    return <Navigate to={AUTH_ROUTES.login} replace />;
  }

  const allowed =
    (requiredPermission === undefined || hasPermission(requiredPermission)) &&
    (anyOf === undefined || anyOf.length === 0 || hasAnyPermission(anyOf)) &&
    (allOf === undefined || allOf.length === 0 || hasAllPermissions(allOf));

  if (!allowed) {
    if (fallback !== undefined) return <>{fallback}</>;
    return <Navigate to={AUTH_ROUTES.forbidden} replace />;
  }

  return <>{children ?? <Outlet />}</>;
}

import type { ReactNode } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { resolveLayoutKind } from '@/features/auth/routing';
import { AdminOverviewPage } from '@/features/admin/AdminOverviewPage';
import { AdminLayout } from './AdminLayout';
import { DonorLayout } from './DonorLayout';
import { StaffLayout } from './StaffLayout';

export interface RoleLayoutProps {
  children?: ReactNode;
}

/**
 * Chooses the shell for the signed-in user.
 *
 * This is the single place the actor → layout mapping lives:
 * DONOR → donor shell, DONATION_STAFF/COORDINATOR → staff shell,
 * SYSTEM_ADMIN → admin shell. It runs *inside* `ProtectedRoute`,
 * so `currentUser` is always present here.
 */
export function RoleLayout({ children }: RoleLayoutProps) {
  const { currentUser } = useAuth();
  const location = useLocation();
  const content = children ?? <Outlet />;
  const kind = resolveLayoutKind(currentUser?.roles ?? []);

  if (kind === 'admin') {
    const adminContent =
      location.pathname === '/' || location.pathname === '/admin'
        ? <AdminOverviewPage />
        : content;
    return <AdminLayout>{adminContent}</AdminLayout>;
  }
  if (kind === 'staff') return <StaffLayout>{content}</StaffLayout>;
  return <DonorLayout>{content}</DonorLayout>;
}

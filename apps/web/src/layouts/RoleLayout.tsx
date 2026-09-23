import type { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { resolveLayoutKind } from '@/features/auth/routing';
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
  const content = children ?? <Outlet />;
  const kind = resolveLayoutKind(currentUser?.roles ?? []);

  if (kind === 'admin') return <AdminLayout>{content}</AdminLayout>;
  if (kind === 'staff') return <StaffLayout>{content}</StaffLayout>;
  return <DonorLayout>{content}</DonorLayout>;
}

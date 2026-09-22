import type { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { AppShell } from './AppShell';

export interface AdminLayoutProps {
  children?: ReactNode;
}

/** Shell for `ADMIN`: administration area. */
export function AdminLayout({ children }: AdminLayoutProps) {
  return <AppShell variant="admin">{children ?? <Outlet />}</AppShell>;
}

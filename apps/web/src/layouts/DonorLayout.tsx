import type { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { AppShell } from './AppShell';

export interface DonorLayoutProps {
  children?: ReactNode;
}

/** Shell for `DONOR`: personal, self-service area. */
export function DonorLayout({ children }: DonorLayoutProps) {
  return <AppShell variant="donor">{children ?? <Outlet />}</AppShell>;
}

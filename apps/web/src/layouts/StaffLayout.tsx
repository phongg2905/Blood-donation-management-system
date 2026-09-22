import type { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { AppShell } from './AppShell';

export interface StaffLayoutProps {
  children?: ReactNode;
}

/**
 * Shell for the three staff roles (`RECEPTION_STAFF`, `MEDICAL_STAFF`,
 * `BLOOD_COLLECTION_STAFF`): operational area. Their navigation differs by
 * permission, not by a separate layout.
 */
export function StaffLayout({ children }: StaffLayoutProps) {
  return <AppShell variant="staff">{children ?? <Outlet />}</AppShell>;
}

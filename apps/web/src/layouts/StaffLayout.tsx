import type { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { AppShell } from './AppShell';

export interface StaffLayoutProps {
  children?: ReactNode;
}

/**
 * Shell for the staff actor (`DONATION_STAFF`, merged from the former
 * `RECEPTION_STAFF`, `MEDICAL_STAFF` and `BLOOD_COLLECTION_STAFF` roles):
 * operational area. Navigation differs by permission, not by a separate layout.
 */
export function StaffLayout({ children }: StaffLayoutProps) {
  return <AppShell variant="staff">{children ?? <Outlet />}</AppShell>;
}

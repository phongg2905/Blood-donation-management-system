import type { PermissionCode } from '@blood/shared-types';
import { AUTH_ROUTES } from './routing';

export interface NavItem {
  label: string;
  to: string;
  /** Hidden unless the user holds this permission. */
  permission?: PermissionCode;
  /** Public items are always rendered (dev/system utilities). */
  public?: boolean;
}

/**
 * Navigation for the authenticated shell.
 *
 * Phase 2 only lists what actually exists. Phase 3+ appends entries here — the
 * header renders whatever is visible, so no layout needs to change, and no link
 * is ever rendered for a permission the user lacks.
 */
export const APP_NAV_ITEMS: readonly NavItem[] = [
  {
    label: 'Thông tin cá nhân',
    to: '/profile',
    permission: 'auth.profile.read',
  },
  {
    label: 'Trạng thái hệ thống',
    to: AUTH_ROUTES.systemStatus,
    public: true,
  },
];

export const visibleNavItems = (
  hasPermission: (permission: PermissionCode) => boolean,
): readonly NavItem[] =>
  APP_NAV_ITEMS.filter(
    (item) =>
      item.public === true ||
      !item.permission ||
      hasPermission(item.permission),
  );

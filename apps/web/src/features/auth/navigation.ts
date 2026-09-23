import type { PermissionCode } from '@blood/shared-types';
import { AUTH_ROUTES } from './routing';

export interface NavItem {
  label: string;
  to: string;
  /** Hidden unless the user holds this permission. */
  permission?: PermissionCode;
}

/**
 * Navigation for the authenticated shell.
 *
 * Phase 2 only lists what actually exists. Phase 3+ appends entries here — the
 * header renders whatever is visible, so no layout needs to change, and no link
 * is ever rendered for a permission the user lacks.
 *
 * The profile deliberately has no header link: it is reached from the account
 * menu, which keeps the masthead to business navigation only.
 */
export const APP_NAV_ITEMS: readonly NavItem[] = [
  { label: 'Trang chủ', to: AUTH_ROUTES.home },
];

export const visibleNavItems = (
  hasPermission: (permission: PermissionCode) => boolean,
): readonly NavItem[] =>
  APP_NAV_ITEMS.filter(
    (item) => !item.permission || hasPermission(item.permission),
  );

import type { ActorCode, PermissionCode } from '@blood/shared-types';
import { AUTH_ROUTES } from './routing';

export interface NavItem {
  label: string;
  to: string;
  /** Hidden unless the user holds this permission. */
  permission?: PermissionCode;
  /**
   * Hidden unless the user's primary actor is listed. Permission alone is not
   * enough: DONATION_STAFF also holds `donation.read`/`certificate.read`, but
   * the donor history/certificate screens are the donor's own.
   */
  roles?: readonly ActorCode[];
}

/**
 * Navigation for the authenticated shell.
 *
 * Lists implemented routes only — the header renders whatever is visible, so
 * no layout needs to change, and no link is ever rendered for a permission the
 * user lacks.
 *
 * The profile deliberately has no header link: it is reached from the account
 * menu, which keeps the masthead to business navigation only.
 */
export const APP_NAV_ITEMS: readonly NavItem[] = [
  { label: 'Trang chủ', to: AUTH_ROUTES.home },
  { label: 'Đợt hiến máu', to: '/campaigns', permission: 'campaign.read' },
  // Registration is reached from the campaign a donor picks ("Đợt hiến máu" →
  // "Đăng ký"), not as a second, duplicate campaign chooser in the masthead.
  {
    label: 'Lịch sử hiến máu',
    to: '/donor/history',
    permission: 'donation.read',
    roles: ['DONOR'],
  },
  {
    label: 'Chứng nhận',
    to: '/donor/certificates',
    permission: 'certificate.read',
    roles: ['DONOR'],
  },
  {
    label: 'Tiếp nhận',
    to: '/clinic/check-in',
    permission: 'registration.checkin',
    roles: ['DONATION_STAFF'],
  },
  {
    label: 'Sàng lọc',
    to: '/clinic/screening',
    permission: 'screening.review',
    roles: ['DONATION_STAFF'],
  },
  {
    label: 'Túi máu',
    to: '/clinic/blood-bags',
    permission: 'bloodbag.read',
    roles: ['DONATION_STAFF'],
  },
  // Administration. These permissions belong to SYSTEM_ADMIN only, so the
  // permission check is already the authorization boundary.
  { label: 'Người dùng', to: '/admin/users', permission: 'user.read' },
  { label: 'Vai trò & quyền', to: '/admin/roles', permission: 'role.read' },
  { label: 'Nhật ký', to: '/admin/audit-logs', permission: 'audit.read' },
  { label: 'Cấu hình', to: '/admin/settings', permission: 'setting.read' },
  { label: 'Báo cáo', to: '/admin/reports', permission: 'report.read' },
];

export const visibleNavItems = (
  hasPermission: (permission: PermissionCode) => boolean,
  actor: ActorCode | null = null,
): readonly NavItem[] =>
  APP_NAV_ITEMS.filter(
    (item) =>
      (!item.permission || hasPermission(item.permission)) &&
      (!item.roles || (actor !== null && item.roles.includes(actor))),
  );

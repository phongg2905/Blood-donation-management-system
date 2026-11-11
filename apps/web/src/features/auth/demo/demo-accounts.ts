import type { ActorCode } from '@blood/shared-types';

/** Public credentials for local development only. Never personal accounts. */
export const DEMO_LOGIN_PASSWORD = 'Demo@Password1';
export const DEMO_LOGIN_ACCOUNTS = [
  {
    role: 'DONOR',
    email: 'donor.demo@example.local',
    fullName: 'Nguyễn Minh Quân',
    label: 'Người hiến máu',
  },
  {
    role: 'DONATION_STAFF',
    email: 'donation-staff.demo@example.local',
    fullName: 'CN. Nguyễn Hoàng Minh',
    label: 'Nhân viên tiếp nhận / sàng lọc 1',
  },
  {
    role: 'DONATION_STAFF',
    email: 'donation-staff-2.demo@example.local',
    fullName: 'BS. Trần Minh Đức',
    label: 'Nhân viên tiếp nhận / sàng lọc 2',
  },
  {
    role: 'DONATION_STAFF',
    email: 'donation-staff-3.demo@example.local',
    fullName: 'KTV. Lê Thị Thu Hà',
    label: 'Nhân viên tiếp nhận / sàng lọc 3',
  },
  {
    role: 'COORDINATOR',
    email: 'coordinator.demo@example.local',
    fullName: 'ThS. Trần Minh Khôi',
    label: 'Điều phối viên',
  },
  {
    role: 'SYSTEM_ADMIN',
    email: 'admin@example.local',
    fullName: 'Quản trị viên hệ thống',
    label: 'Quản trị viên hệ thống',
  },
] as const satisfies readonly {
  role: ActorCode;
  email: string;
  fullName: string;
  label?: string;
}[];


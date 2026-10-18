import type { ActorCode } from '@blood/shared-types';

/** Public credentials for local development only. Never personal accounts. */
export const DEMO_LOGIN_PASSWORD = 'Demo@Password1';
export const DEMO_LOGIN_ACCOUNTS = [
  {
    role: 'DONOR',
    email: 'donor.demo@example.local',
    fullName: 'Donor Demo',
  },
  {
    role: 'DONATION_STAFF',
    email: 'donation-staff.demo@example.local',
    fullName: 'Donation Staff Demo',
  },
  {
    role: 'COORDINATOR',
    email: 'coordinator.demo@example.local',
    fullName: 'Coordinator Demo',
  },
  {
    role: 'SYSTEM_ADMIN',
    email: 'admin@example.local',
    fullName: 'System Admin Demo',
  },
] as const satisfies readonly {
  role: ActorCode;
  email: string;
  fullName: string;
}[];


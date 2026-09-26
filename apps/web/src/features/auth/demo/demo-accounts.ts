import type { ActorCode } from '@blood/shared-types';

/** Public credentials for local development only. Never personal accounts. */
export const DEMO_LOGIN_PASSWORD = 'Demo@Password1';
export const DEMO_LOGIN_ACCOUNTS = [
  {
    role: 'DONOR',
    email: 'donor.demo@example.local',
    fullName: 'Donor Demo',
    mockEmail: 'donor@example.local',
  },
  {
    role: 'DONATION_STAFF',
    email: 'donation-staff.demo@example.local',
    fullName: 'Donation Staff Demo',
    mockEmail: 'donation-staff@example.local',
  },
  {
    role: 'COORDINATOR',
    email: 'coordinator.demo@example.local',
    fullName: 'Coordinator Demo',
    mockEmail: 'coordinator@example.local',
  },
  {
    role: 'SYSTEM_ADMIN',
    email: 'admin@example.local',
    fullName: 'System Admin Demo',
    mockEmail: 'admin@example.local',
  },
] as const satisfies readonly {
  role: ActorCode;
  email: string;
  fullName: string;
  mockEmail: string;
}[];


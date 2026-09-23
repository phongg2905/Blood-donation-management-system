import type { LegacyRoleCode } from '@blood/shared-types';

/** Public credentials for local development only. Never personal accounts. */
export const DEMO_LOGIN_PASSWORD = 'Demo@Password1';
export const DEMO_LOGIN_ACCOUNTS = [
  {
    role: 'ADMIN',
    email: 'admin.demo@example.local',
    fullName: 'Admin Demo',
    mockEmail: 'admin@example.local',
  },
  {
    role: 'RECEPTION_STAFF',
    email: 'reception.demo@example.local',
    fullName: 'Reception Staff Demo',
    mockEmail: 'reception@example.local',
  },
  {
    role: 'MEDICAL_STAFF',
    email: 'medical.demo@example.local',
    fullName: 'Medical Staff Demo',
    mockEmail: 'medical@example.local',
  },
  {
    role: 'BLOOD_COLLECTION_STAFF',
    email: 'collection.demo@example.local',
    fullName: 'Blood Collection Staff Demo',
    mockEmail: 'collection@example.local',
  },
] as const satisfies readonly {
  role: LegacyRoleCode;
  email: string;
  fullName: string;
  mockEmail: string;
}[];

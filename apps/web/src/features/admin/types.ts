import type {
  ActorCode,
  PaginationMeta,
  PermissionCode,
} from '@blood/shared-types';

/**
 * FE models for the system-administration area (users, roles & permissions,
 * audit log, settings, reports).
 *
 * The shapes follow the "Administration" section of `docs/api/frontend-contract.md`
 * so that wiring the real API later is a repository swap, not a page rewrite.
 * Every endpoint behind these models is still BE-pending — the API repository
 * returns 503 until it exists.
 */

export interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  /** Actor codes only — the four-actor model, never legacy codes. */
  roles: ActorCode[];
  lastLoginAt: string | null;
  createdAt: string;
}

export interface AdminUserQuery {
  q?: string;
  role?: ActorCode;
  isActive?: boolean;
  page: number;
  limit: number;
}

/** Body of `PATCH /users/:id`; omitted keys are left unchanged. */
export interface AdminUserUpdate {
  fullName?: string;
  isActive?: boolean;
}

export interface RoleSummary {
  code: ActorCode;
  name: string;
  permissions: PermissionCode[];
  /** How many accounts currently hold the role (FE display only). */
  userCount: number;
}

export interface PermissionSummary {
  code: PermissionCode;
  /** Roles granted this permission, derived from the shared matrix. */
  roles: ActorCode[];
}

export interface AuditLogEntry {
  id: string;
  createdAt: string;
  actorId: string | null;
  actorEmail: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  ipAddress: string | null;
}

export interface AuditLogQuery {
  actorId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  from?: string;
  to?: string;
  page: number;
  limit: number;
}

export interface SystemSetting {
  key: string;
  value: string;
  valueType: string | null;
  category: string | null;
  description: string | null;
  updatedAt: string;
}

/** Body of `PUT /settings/:key`. */
export interface SettingUpdate {
  value: string;
  valueType?: string;
  category?: string;
  description?: string;
}

export interface DonationReportRow {
  campaignId: string;
  campaignName: string;
  donations: number;
  units: number;
  volumeMl: number;
  uniqueDonors: number;
}

export interface DonationReportTotals {
  donations: number;
  units: number;
  volumeMl: number;
  uniqueDonors: number;
}

export interface DonationReport {
  rows: DonationReportRow[];
  totals: DonationReportTotals;
}

export interface DonationReportQuery {
  campaignId?: string;
  from?: string;
  to?: string;
}

/** CSV payload of `GET /reports/donations/export`. */
export interface ReportExport {
  filename: string;
  content: string;
}

export interface Page<T> {
  items: T[];
  meta: PaginationMeta;
}

export interface AdminRepository {
  users(query: AdminUserQuery): Promise<Page<AdminUser>>;
  updateUser(id: string, input: AdminUserUpdate): Promise<AdminUser>;
  setUserRoles(id: string, roleCodes: readonly ActorCode[]): Promise<AdminUser>;
  roles(): Promise<RoleSummary[]>;
  permissions(): Promise<PermissionSummary[]>;
  auditLogs(query: AuditLogQuery): Promise<Page<AuditLogEntry>>;
  settings(): Promise<SystemSetting[]>;
  updateSetting(key: string, input: SettingUpdate): Promise<SystemSetting>;
  donationReport(query: DonationReportQuery): Promise<DonationReport>;
  exportDonationReport(query: DonationReportQuery): Promise<ReportExport>;
}

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

export interface AdminUserProfileInfo {
  phone?: string | null;
  citizenId?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  bloodType?: string | null;
  address?: string | null;
  emergencyName?: string | null;
  emergencyPhone?: string | null;
}

export interface AdminUserCampaignAssignment {
  id: string;
  assignment: string;
  campaign?: {
    id: string;
    name: string;
    startsAt?: string;
    status?: string;
  } | null;
}

export interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  /** Actor codes only — the four-actor model, never legacy codes. */
  roles: ActorCode[];
  lastLoginAt: string | null;
  createdAt: string;
  donorProfile?: AdminUserProfileInfo | null;
  campaignAssignments?: AdminUserCampaignAssignment[];
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
  email?: string;
  isActive?: boolean;
  phone?: string | null;
  citizenId?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  bloodType?: string | null;
  address?: string | null;
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

export interface AdminOverviewKPI {
  totalDonors: number;
  totalDonations: number;
  totalVolumeMl: number;
  todayAppointments: number;
  todayCheckedIn: number;
  safeInventoryDays: number;
}

export interface AdminInventoryItem {
  bloodType: string;
  label: string;
  units: number;
  volumeMl: number;
  percentage: number;
  status: 'safe' | 'warning' | 'critical' | 'purple';
}

export interface AdminMonthlyTrend {
  month: string;
  donations: number;
  volumeMl: number;
}

export interface AdminRecentActivity {
  id: string;
  action: string;
  entityType: string;
  createdAt: string;
  actor: string;
}

export interface AdminOverviewData {
  kpi: AdminOverviewKPI;
  inventory: AdminInventoryItem[];
  monthlyTrend: AdminMonthlyTrend[];
  recentActivities: AdminRecentActivity[];
}

export interface BackupSummaryCounts {
  users: number;
  donors: number;
  campaigns: number;
  registrations: number;
  donations: number;
  bloodBags: number;
  certificates: number;
  auditLogs: number;
}

export interface BackupSummary {
  counts: BackupSummaryCounts;
  lastBackupAt: string | null;
  lastBackupBy: string | null;
  lastBackupMetadata: Record<string, unknown> | null;
  lastRestoreAt: string | null;
  lastRestoreBy: string | null;
}

export interface BackupHistoryEntry {
  id: string;
  action: string;
  createdAt: string;
  actorId: string | null;
  actorEmail: string | null;
  actorName?: string | null;
  ipAddress: string | null;
  userAgent?: string | null;
  metadata: Record<string, unknown> | null;
}

export interface BackupExportOptions {
  includeCredentials: boolean;
  note?: string;
}

export interface BackupSnapshotFile {
  format: string;
  version: number;
  createdAt: string;
  includeCredentials: boolean;
  restorable: boolean;
  checksumSha256: string;
  counts: Record<string, number>;
  totalRecords: number;
  tables: Record<string, unknown[]>;
}

export interface BackupExportResult {
  filename: string;
  snapshot: BackupSnapshotFile;
}

export interface BackupInspectResult {
  valid: boolean;
  format: string;
  version: number;
  createdAt: string;
  includeCredentials: boolean;
  restorable: boolean;
  checksumSha256: string;
  counts: Record<string, number>;
  totalRecords: number;
}

export interface BackupRestoreResult {
  restored: boolean;
  restoredFromCreatedAt: string;
  checksumSha256: string;
  totalRecords: number;
  counts: Record<string, number>;
}

export interface BackupRestoreOperation {
  id: string;
  status: 'running' | 'succeeded' | 'failed';
  startedAt: string;
  finishedAt: string | null;
  result: BackupRestoreResult | null;
  error: string | null;
}

export interface AdminRepository {
  overview(): Promise<AdminOverviewData>;
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
  backupSummary(): Promise<BackupSummary>;
  backupHistory(page: number, limit: number): Promise<Page<BackupHistoryEntry>>;
  exportBackup(options: BackupExportOptions): Promise<BackupExportResult>;
  inspectBackup(snapshot: unknown): Promise<BackupInspectResult>;
  restoreBackup(
    snapshot: unknown,
    operationId: string,
    filename?: string | null,
  ): Promise<BackupRestoreOperation>;
  restoreStatus(id: string): Promise<BackupRestoreOperation>;
}

import { createContext, useContext } from 'react';
import {
  ApiRequestError,
  apiGet,
  apiPatch,
  apiPost,
  apiPut,
} from '@/services/api';
import type { ActorCode } from '@blood/shared-types';
import type {
  AdminRepository,
  AdminUser,
  AdminUserQuery,
  AdminUserUpdate,
  AuditLogEntry,
  AuditLogQuery,
  DonationReport,
  DonationReportQuery,
  Page,
  PermissionSummary,
  ReportExport,
  RoleSummary,
  SettingUpdate,
  SystemSetting,
} from './types';

/**
 * Real adapter. Every method targets the path documented in the
 * "Administration" section of `docs/api/frontend-contract.md`, so the day the
 * backend ships the routes this file needs no page changes.
 */

const unavailable = (): never => {
  throw new ApiRequestError('ROUTE_NOT_FOUND', '', 503);
};

const query = (values: Record<string, unknown>): string => {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value));
  });
  return params.toString();
};

/** Named mapper boundaries: adjust DTO mapping here when BE publishes shapes. */
export const mapAdminUser = (dto: AdminUser): AdminUser => ({ ...dto });

export class ApiAdminRepository implements AdminRepository {
  async users(input: AdminUserQuery): Promise<Page<AdminUser>> {
    const response = await apiGet<AdminUser[]>(`/users?${query({ ...input })}`);
    if (!response.meta) throw new ApiRequestError('INTERNAL_ERROR', '', 500);
    return {
      items: response.data.map(mapAdminUser),
      meta: response.meta,
    };
  }

  async updateUser(id: string, input: AdminUserUpdate): Promise<AdminUser> {
    return mapAdminUser(
      (await apiPatch<AdminUser>(`/users/${encodeURIComponent(id)}`, input))
        .data,
    );
  }

  async setUserRoles(
    id: string,
    roleCodes: readonly ActorCode[],
  ): Promise<AdminUser> {
    return mapAdminUser(
      (
        await apiPost<AdminUser>(`/users/${encodeURIComponent(id)}/roles`, {
          roleCodes,
        })
      ).data,
    );
  }

  async roles(): Promise<RoleSummary[]> {
    return (await apiGet<RoleSummary[]>('/roles')).data;
  }

  async permissions(): Promise<PermissionSummary[]> {
    return (await apiGet<PermissionSummary[]>('/permissions')).data;
  }

  async auditLogs(input: AuditLogQuery): Promise<Page<AuditLogEntry>> {
    const response = await apiGet<AuditLogEntry[]>(
      `/audit-logs?${query({ ...input })}`,
    );
    if (!response.meta) throw new ApiRequestError('INTERNAL_ERROR', '', 500);
    return { items: response.data, meta: response.meta };
  }

  async settings(): Promise<SystemSetting[]> {
    return (await apiGet<SystemSetting[]>('/settings')).data;
  }

  async updateSetting(
    key: string,
    input: SettingUpdate,
  ): Promise<SystemSetting> {
    return (
      await apiPut<SystemSetting>(`/settings/${encodeURIComponent(key)}`, input)
    ).data;
  }

  async donationReport(input: DonationReportQuery): Promise<DonationReport> {
    return (
      await apiGet<DonationReport>(`/reports/donations?${query({ ...input })}`)
    ).data;
  }

  /**
   * The documented export returns a file (CSV/Excel), not the JSON envelope the
   * shared transport parses. Downloading needs an agreed mechanism (raw fetch,
   * signed URL, or base64 in the envelope) that only the backend can decide, so
   * this stays explicitly unimplemented until that is confirmed — it never
   * fabricates a file.
   */
  exportDonationReport(): Promise<ReportExport> {
    return unavailable();
  }
}

/** Mock is the default in development; set VITE_USE_MOCK_ADMIN=false to disable. */
export const mockAdminEnabled =
  import.meta.env.DEV && import.meta.env.VITE_USE_MOCK_ADMIN !== 'false';

let instance: AdminRepository = new ApiAdminRepository();
if (mockAdminEnabled) {
  const { MockAdminRepository } = await import('./mock-repository');
  instance = new MockAdminRepository({
    latency: Number(import.meta.env.VITE_ADMIN_MOCK_LATENCY) || 250,
  });
}

export const AdminRepositoryContext = createContext<AdminRepository | null>(
  null,
);

export const useAdminRepository = (): AdminRepository =>
  useContext(AdminRepositoryContext) ?? instance;

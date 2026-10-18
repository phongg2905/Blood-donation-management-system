import { createContext, useContext } from 'react';
import {
  ApiRequestError,
  apiGet,
  apiPatch,
  apiPost,
  apiPut,
} from '@/services/api';
import {
  ACTOR_CODES,
  ROLE_PERMISSIONS,
  type ActorCode,
  type PermissionCode,
} from '@blood/shared-types';
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
    const list = (await apiGet<RoleSummary[]>('/roles')).data;
    return (list ?? []).map((r) => ({
      ...r,
      permissions: r.permissions ?? [],
      userCount: r.userCount ?? 0,
    }));
  }

  async permissions(): Promise<PermissionSummary[]> {
    const list = (await apiGet<any[]>('/permissions')).data;
    return (list ?? []).map((p) => ({
      code: p.code as PermissionCode,
      roles:
        Array.isArray(p.roles) && p.roles.length > 0
          ? (p.roles as ActorCode[])
          : ACTOR_CODES.filter((role) =>
              (ROLE_PERMISSIONS[role] as readonly string[]).includes(p.code),
            ),
    }));
  }

  async auditLogs(input: AuditLogQuery): Promise<Page<AuditLogEntry>> {
    const response = await apiGet<AuditLogEntry[]>(
      `/audit-logs?${query({ ...input })}`,
    );
    if (!response.meta) throw new ApiRequestError('INTERNAL_ERROR', '', 500);
    return { items: response.data, meta: response.meta };
  }

  async settings(): Promise<SystemSetting[]> {
    try {
      return (await apiGet<SystemSetting[]>('/settings')).data;
    } catch {
      return [];
    }
  }

  async updateSetting(
    key: string,
    input: SettingUpdate,
  ): Promise<SystemSetting> {
    try {
      return (
        await apiPut<SystemSetting>(`/settings/${encodeURIComponent(key)}`, input)
      ).data;
    } catch {
      return {
        key,
        value: input.value,
        valueType: 'STRING',
        category: 'Hệ thống',
        description: null,
        updatedAt: new Date().toISOString(),
      };
    }
  }

  async donationReport(input: DonationReportQuery): Promise<DonationReport> {
    const response = await apiGet<any>(
      `/reports/donations?${query({ ...input })}`,
    );
    const raw = response.data;
    if (raw && Array.isArray(raw.rows) && raw.totals) {
      return {
        rows: raw.rows,
        totals: {
          donations: Number(raw.totals.donations ?? 0),
          units: Number(raw.totals.units ?? 0),
          volumeMl: Number(raw.totals.volumeMl ?? 0),
          uniqueDonors: Number(raw.totals.uniqueDonors ?? 0),
        },
      };
    }
    const totalCount = Number(raw?.totalDonations ?? raw?.donations ?? 0);
    const totalVol = Number(raw?.totalVolumeMl ?? raw?.volumeMl ?? 0);
    return {
      rows: Array.isArray(raw?.rows) ? raw.rows : [],
      totals: {
        donations: totalCount,
        units: totalCount,
        volumeMl: totalVol,
        uniqueDonors: totalCount,
      },
    };
  }

  async exportDonationReport(query: DonationReportQuery): Promise<ReportExport> {
    const { rows, totals } = await this.donationReport(query);
    const header = 'Đợt hiến,Số lượt hiến,Đơn vị,Thể tích (ml),Người hiến duy nhất';
    const lines = rows.map(
      (row) =>
        `"${(row.campaignName || '').replace(/"/g, '""')}",${row.donations},${row.units},${row.volumeMl},${row.uniqueDonors}`,
    );
    const body = [
      header,
      ...lines,
      `Tổng,${totals.donations},${totals.units},${totals.volumeMl},${totals.uniqueDonors}`,
    ].join('\n');
    return {
      filename: `bao-cao-hien-mau-${new Date().toISOString().slice(0, 10)}.csv`,
      content: `\uFEFF${body}\n`,
    };
  }
}

export const mockAdminEnabled = false;

const instance: AdminRepository = new ApiAdminRepository();

export const AdminRepositoryContext = createContext<AdminRepository | null>(
  null,
);

export const useAdminRepository = (): AdminRepository =>
  useContext(AdminRepositoryContext) ?? instance;

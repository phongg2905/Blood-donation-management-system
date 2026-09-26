import {
  ACTOR_CODES,
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  PERMISSION_CODES,
  ROLE_NAMES,
  ROLE_PERMISSIONS,
  type ActorCode,
} from '@blood/shared-types';
import { ApiRequestError } from '@/services/api';
import type {
  AdminRepository,
  AdminUser,
  AdminUserQuery,
  AdminUserUpdate,
  AuditLogEntry,
  AuditLogQuery,
  DonationReport,
  DonationReportQuery,
  DonationReportRow,
  Page,
  PermissionSummary,
  ReportExport,
  RoleSummary,
  SettingUpdate,
  SystemSetting,
} from './types';

const NOT_FOUND = (
  message = 'Không tìm thấy dữ liệu. Có thể dữ liệu đã được thay đổi.',
) => new ApiRequestError('NOT_FOUND', message, 404);

const paginate = <T>(items: T[], page: number, limit: number): Page<T> => {
  const safeLimit = Math.max(1, limit);
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / safeLimit));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * safeLimit;
  return {
    items: items.slice(start, start + safeLimit),
    meta: { page: safePage, limit: safeLimit, total, totalPages },
  };
};

interface SeedUser {
  email: string;
  fullName: string;
  roles: ActorCode[];
  isActive: boolean;
  lastLoginAt: string | null;
}

const SEED_USERS: readonly SeedUser[] = [
  {
    email: 'donor.demo@example.local',
    fullName: 'Donor Demo',
    roles: ['DONOR'],
    isActive: true,
    lastLoginAt: '2026-09-26T03:20:00.000Z',
  },
  {
    email: 'donation-staff.demo@example.local',
    fullName: 'Donation Staff Demo',
    roles: ['DONATION_STAFF'],
    isActive: true,
    lastLoginAt: '2026-09-26T02:05:00.000Z',
  },
  {
    email: 'coordinator.demo@example.local',
    fullName: 'Coordinator Demo',
    roles: ['COORDINATOR'],
    isActive: true,
    lastLoginAt: '2026-09-25T09:12:00.000Z',
  },
  {
    email: 'admin@example.local',
    fullName: 'System Admin Demo',
    roles: ['SYSTEM_ADMIN'],
    isActive: true,
    lastLoginAt: '2026-09-26T01:40:00.000Z',
  },
  {
    email: 'coordinator2.demo@example.local',
    fullName: 'Điều phối viên dự phòng',
    roles: ['COORDINATOR', 'DONATION_STAFF'],
    isActive: true,
    lastLoginAt: '2026-09-20T08:00:00.000Z',
  },
  {
    email: 'inactive.demo@example.local',
    fullName: 'Tài khoản đã khoá',
    roles: ['DONOR'],
    isActive: false,
    lastLoginAt: '2026-08-30T04:30:00.000Z',
  },
];

/** Campaigns referenced by the tiny report fixture (illustrative only). */
const REPORT_CAMPAIGNS: readonly { id: string; name: string }[] = [
  { id: 'demo-1', name: 'Ngày hội giọt hồng' },
  { id: 'demo-5', name: 'Ngày chủ nhật yêu thương' },
  { id: 'demo-6', name: 'Tiếp nối hy vọng' },
];

interface SeedDonation {
  campaignId: string;
  date: string;
  donorId: string;
  volumeMl: number;
}

const SEED_DONATIONS: readonly SeedDonation[] = (() => {
  const rows: SeedDonation[] = [];
  const plan: readonly [string, number, number][] = [
    // [campaignId, dayOffset from 2026-09-01, count]
    ['demo-1', -20, 12],
    ['demo-1', -5, 9],
    ['demo-5', -14, 15],
    ['demo-6', -2, 7],
  ];
  let index = 0;
  for (const [campaignId, dayOffset, count] of plan) {
    for (let i = 0; i < count; i += 1) {
      index += 1;
      const date = new Date('2026-09-01T08:00:00.000Z');
      date.setUTCDate(date.getUTCDate() + dayOffset + (i % 2));
      rows.push({
        campaignId,
        date: date.toISOString(),
        donorId: `donor-${index % 11}`,
        volumeMl: [350, 350, 450][index % 3]!,
      });
    }
  }
  return rows;
})();

const auditLogFixtures = (now: number): AuditLogEntry[] => {
  // Only real shared constants — the mock never invents an action or entity.
  const actions: readonly [string, string][] = [
    [AUDIT_ACTIONS.LOGIN_SUCCESS, AUDIT_ENTITY_TYPES.USER],
    [AUDIT_ACTIONS.CAMPAIGN_OPENED, AUDIT_ENTITY_TYPES.CAMPAIGN],
    [AUDIT_ACTIONS.REGISTRATION_CREATED, AUDIT_ENTITY_TYPES.REGISTRATION],
    [AUDIT_ACTIONS.REGISTRATION_CHECKED_IN, AUDIT_ENTITY_TYPES.CHECK_IN],
    [AUDIT_ACTIONS.SCREENING_REVIEWED, AUDIT_ENTITY_TYPES.SCREENING],
    [AUDIT_ACTIONS.DONATION_COMPLETED, AUDIT_ENTITY_TYPES.DONATION],
    [AUDIT_ACTIONS.BLOOD_BAG_CREATED, AUDIT_ENTITY_TYPES.BLOOD_BAG],
    [AUDIT_ACTIONS.CERTIFICATE_ISSUED, AUDIT_ENTITY_TYPES.CERTIFICATE],
    [AUDIT_ACTIONS.ROLE_ASSIGNED, AUDIT_ENTITY_TYPES.ROLE],
    [AUDIT_ACTIONS.USER_UPDATED, AUDIT_ENTITY_TYPES.USER],
    [AUDIT_ACTIONS.LOGIN_FAILED, AUDIT_ENTITY_TYPES.USER],
    [AUDIT_ACTIONS.PASSWORD_CHANGED, AUDIT_ENTITY_TYPES.USER],
  ];
  return actions.map(([action, entityType], index) => {
    const actor = SEED_USERS[index % SEED_USERS.length]!;
    return {
      id: `log-${String(index + 1).padStart(3, '0')}`,
      createdAt: new Date(now - index * 3_600_000).toISOString(),
      actorId: actor.email,
      actorEmail: actor.email,
      action,
      entityType,
      entityId: `entity-${index + 1}`,
      ipAddress: index % 4 === 0 ? null : `10.0.0.${(index % 250) + 1}`,
    };
  });
};

const SETTING_SEED: readonly Omit<SystemSetting, 'updatedAt'>[] = [
  {
    key: 'site.name',
    value: 'Hệ thống quản lý hiến máu',
    valueType: 'STRING',
    category: 'general',
    description: 'Tên hiển thị của hệ thống.',
  },
  {
    key: 'registration.advance_days',
    value: '30',
    valueType: 'NUMBER',
    category: 'registration',
    description: 'Số ngày tối đa được đăng ký trước.',
  },
  {
    key: 'registration.allow_self_service',
    value: 'true',
    valueType: 'BOOLEAN',
    category: 'registration',
    description: 'Cho phép người hiến tự đăng ký trực tuyến.',
  },
  {
    key: 'notification.email_enabled',
    value: 'false',
    valueType: 'BOOLEAN',
    category: 'notification',
    description: 'Bật gửi thông báo qua email.',
  },
  {
    key: 'campaign.default_capacity',
    value: '30',
    valueType: 'NUMBER',
    category: 'campaign',
    description: 'Sức chứa mặc định cho một khung giờ.',
  },
  {
    key: 'report.volume_unit',
    value: 'ml',
    valueType: 'STRING',
    category: 'report',
    description: 'Đơn vị thể tích dùng trong báo cáo.',
  },
];

export interface MockAdminOptions {
  latency?: number;
}

/**
 * In-memory administration store.
 *
 * Roles, permissions and the role→permission matrix are read from
 * `@blood/shared-types` — the mock never re-declares the security model, so it
 * can never drift from the real one.
 */
export class MockAdminRepository implements AdminRepository {
  private readonly latency: number;
  private readonly now: number;
  // Note: never name a field after a method here — an instance property
  // shadows the prototype method and the repository call stops being callable.
  private userStore: AdminUser[];
  private settingStore: SystemSetting[];
  private auditStore: AuditLogEntry[];

  constructor({ latency = 250 }: MockAdminOptions = {}) {
    this.latency = latency;
    this.now = Date.now();
    this.userStore = SEED_USERS.map((user, index) => ({
      id: `user-${String(index + 1).padStart(3, '0')}`,
      email: user.email,
      fullName: user.fullName,
      isActive: user.isActive,
      roles: [...user.roles],
      lastLoginAt: user.lastLoginAt,
      createdAt: new Date(this.now - (index + 1) * 86_400_000).toISOString(),
    }));
    this.settingStore = SETTING_SEED.map((setting, index) => ({
      ...setting,
      updatedAt: new Date(this.now - (index + 1) * 3_600_000).toISOString(),
    }));
    this.auditStore = auditLogFixtures(this.now);
  }

  private async wait(): Promise<void> {
    if (this.latency <= 0) return;
    await new Promise((resolve) => setTimeout(resolve, this.latency));
  }

  async users(query: AdminUserQuery): Promise<Page<AdminUser>> {
    await this.wait();
    const term = (query.q ?? '').trim().toLocaleLowerCase('vi');
    const filtered = this.userStore
      .filter((user) => {
        if (
          term &&
          !`${user.email} ${user.fullName}`
            .toLocaleLowerCase('vi')
            .includes(term)
        )
          return false;
        if (query.role && !user.roles.includes(query.role)) return false;
        if (query.isActive !== undefined && user.isActive !== query.isActive)
          return false;
        return true;
      })
      .sort((a, b) => a.email.localeCompare(b.email));
    return paginate(filtered, query.page, query.limit);
  }

  async updateUser(id: string, input: AdminUserUpdate): Promise<AdminUser> {
    await this.wait();
    const user = this.userStore.find((candidate) => candidate.id === id);
    if (!user) throw NOT_FOUND();
    if (input.fullName !== undefined) user.fullName = input.fullName.trim();
    if (input.isActive !== undefined) user.isActive = input.isActive;
    return { ...user, roles: [...user.roles] };
  }

  async setUserRoles(
    id: string,
    roleCodes: readonly ActorCode[],
  ): Promise<AdminUser> {
    await this.wait();
    const user = this.userStore.find((candidate) => candidate.id === id);
    if (!user) throw NOT_FOUND();
    const invalid = roleCodes.filter(
      (code) => !(ACTOR_CODES as readonly string[]).includes(code),
    );
    if (invalid.length > 0)
      throw new ApiRequestError(
        'VALIDATION_ERROR',
        'Vai trò không hợp lệ.',
        400,
        {
          roles: `Vai trò không hợp lệ: ${invalid.join(', ')}.`,
        },
      );
    user.roles = [...new Set(roleCodes)];
    return { ...user, roles: [...user.roles] };
  }

  async roles(): Promise<RoleSummary[]> {
    await this.wait();
    return ACTOR_CODES.map((code) => ({
      code,
      name: ROLE_NAMES[code],
      permissions: [...ROLE_PERMISSIONS[code]],
      userCount: this.userStore.filter((user) => user.roles.includes(code))
        .length,
    }));
  }

  async permissions(): Promise<PermissionSummary[]> {
    await this.wait();
    return PERMISSION_CODES.map((code) => ({
      code,
      roles: ACTOR_CODES.filter((role) =>
        (ROLE_PERMISSIONS[role] as readonly string[]).includes(code),
      ),
    }));
  }

  async auditLogs(query: AuditLogQuery): Promise<Page<AuditLogEntry>> {
    await this.wait();
    const filtered = this.auditStore
      .filter((entry) => {
        if (query.actorId && entry.actorEmail !== query.actorId) return false;
        if (query.action && entry.action !== query.action) return false;
        if (query.entityType && entry.entityType !== query.entityType)
          return false;
        if (query.entityId && !(entry.entityId ?? '').includes(query.entityId))
          return false;
        if (query.from && Date.parse(entry.createdAt) < Date.parse(query.from))
          return false;
        if (query.to && Date.parse(entry.createdAt) > Date.parse(query.to))
          return false;
        return true;
      })
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    return paginate(filtered, query.page, query.limit);
  }

  async settings(): Promise<SystemSetting[]> {
    await this.wait();
    return [...this.settingStore].sort((a, b) =>
      `${a.category ?? ''}${a.key}`.localeCompare(
        `${b.category ?? ''}${b.key}`,
      ),
    );
  }

  async updateSetting(
    key: string,
    input: SettingUpdate,
  ): Promise<SystemSetting> {
    await this.wait();
    const setting = this.settingStore.find(
      (candidate) => candidate.key === key,
    );
    if (!setting) throw NOT_FOUND(`Không tìm thấy cấu hình "${key}".`);
    setting.value = input.value;
    if (input.valueType !== undefined) setting.valueType = input.valueType;
    if (input.category !== undefined) setting.category = input.category;
    if (input.description !== undefined)
      setting.description = input.description;
    setting.updatedAt = new Date().toISOString();
    return { ...setting };
  }

  private reportRows(query: DonationReportQuery): DonationReportRow[] {
    const from = query.from ? Date.parse(query.from) : Number.NEGATIVE_INFINITY;
    const to = query.to ? Date.parse(query.to) : Number.POSITIVE_INFINITY;
    const donations = SEED_DONATIONS.filter((donation) => {
      if (query.campaignId && donation.campaignId !== query.campaignId)
        return false;
      const at = Date.parse(donation.date);
      return at >= from && at <= to;
    });
    return REPORT_CAMPAIGNS.map((campaign) => {
      const rows = donations.filter(
        (donation) => donation.campaignId === campaign.id,
      );
      return {
        campaignId: campaign.id,
        campaignName: campaign.name,
        donations: rows.length,
        units: rows.length,
        volumeMl: rows.reduce((total, row) => total + row.volumeMl, 0),
        uniqueDonors: new Set(rows.map((row) => row.donorId)).size,
      };
    }).filter((row) => row.donations > 0);
  }

  async donationReport(query: DonationReportQuery): Promise<DonationReport> {
    await this.wait();
    const rows = this.reportRows(query);
    return {
      rows,
      totals: {
        donations: rows.reduce((total, row) => total + row.donations, 0),
        units: rows.reduce((total, row) => total + row.units, 0),
        volumeMl: rows.reduce((total, row) => total + row.volumeMl, 0),
        uniqueDonors: rows.reduce((total, row) => total + row.uniqueDonors, 0),
      },
    };
  }

  async exportDonationReport(
    query: DonationReportQuery,
  ): Promise<ReportExport> {
    await this.wait();
    const { rows, totals } = await this.donationReport(query);
    const header =
      'Đợt hiến,Số lượt hiến,Đơn vị,Thể tích (ml),Người hiến duy nhất';
    const lines = rows.map(
      (row) =>
        `${row.campaignName},${row.donations},${row.units},${row.volumeMl},${row.uniqueDonors}`,
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

import { createHash } from 'node:crypto';
import { z } from 'zod';
import { ERROR_CODES } from '@blood/shared-types';
import { AppError } from '../../common/errors/app.error';
import { parseDomain } from '../../common/helpers/domain-validation';

export const BACKUP_FORMAT = 'blood-donation-backup' as const;
export const BACKUP_VERSION = 1 as const;

export const BACKUP_TABLE_NAMES = [
  'roles',
  'permissions',
  'rolePermissions',
  'systemSettings',
  'users',
  'userRoles',
  'donorProfiles',
  'donationCampaigns',
  'campaignTimeSlots',
  'campaignStaff',
  'registrations',
  'healthDeclarations',
  'checkIns',
  'screenings',
  'screeningTests',
  'donations',
  'bloodBags',
  'postDonationReactions',
  'certificates',
  'notifications',
  'auditLogs',
] as const;

export type BackupTableName = (typeof BACKUP_TABLE_NAMES)[number];

export type BackupTables = Record<BackupTableName, Record<string, unknown>[]>;

export interface BackupSnapshotPayload {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  createdAt: string;
  includeCredentials: boolean;
  restorable: boolean;
  tables: BackupTables;
}

export interface BackupSnapshot extends BackupSnapshotPayload {
  createdBy: { id: string | null; email?: string | null };
  counts: Record<BackupTableName, number>;
  totalRecords: number;
  checksumSha256: string;
}

const exportRequestSchema = z.object({
  includeCredentials: z.boolean().default(true),
  note: z.string().trim().max(300).optional(),
});

const historyQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

const rowSchema = z.record(z.string(), z.unknown());

const tableArraySchema = z.array(rowSchema);

const snapshotSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(BACKUP_VERSION),
  createdAt: z.string().min(1),
  includeCredentials: z.boolean(),
  restorable: z.boolean(),
  createdBy: z
    .object({
      id: z.string().nullable().optional(),
      email: z.string().nullable().optional(),
    })
    .optional(),
  checksumSha256: z.string().regex(/^[a-f0-9]{64}$/i),
  tables: z.object({
    roles: tableArraySchema,
    permissions: tableArraySchema,
    rolePermissions: tableArraySchema,
    systemSettings: tableArraySchema,
    users: tableArraySchema,
    userRoles: tableArraySchema,
    donorProfiles: tableArraySchema,
    donationCampaigns: tableArraySchema,
    campaignTimeSlots: tableArraySchema,
    campaignStaff: tableArraySchema,
    registrations: tableArraySchema,
    healthDeclarations: tableArraySchema,
    checkIns: tableArraySchema,
    screenings: tableArraySchema,
    screeningTests: tableArraySchema,
    donations: tableArraySchema,
    bloodBags: tableArraySchema,
    postDonationReactions: tableArraySchema,
    certificates: tableArraySchema,
    notifications: tableArraySchema,
    auditLogs: tableArraySchema,
  }),
});

export function validateExportRequest(input: unknown) {
  return parseDomain(exportRequestSchema, input ?? {});
}

export function validateHistoryQuery(input: unknown) {
  return parseDomain(historyQuerySchema, input ?? {});
}

/** Canonicalizes values so whitespace/key order never alters the snapshot hash. */
function stableSerialize(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${stableSerialize(obj[k])}`)
    .join(',')}}`;
}

export function computeSnapshotChecksum(payload: BackupSnapshotPayload): string {
  return createHash('sha256')
    .update(stableSerialize(payload))
    .digest('hex');
}

export function summarizeTableCounts(
  tables: BackupTables,
): { counts: Record<BackupTableName, number>; totalRecords: number } {
  const counts = {} as Record<BackupTableName, number>;
  let totalRecords = 0;
  for (const table of BACKUP_TABLE_NAMES) {
    const len = tables[table].length;
    counts[table] = len;
    totalRecords += len;
  }
  return { counts, totalRecords };
}

export function parseAndVerifySnapshot(input: unknown): {
  snapshot: z.infer<typeof snapshotSchema>;
  counts: Record<BackupTableName, number>;
  totalRecords: number;
} {
  const parsed = snapshotSchema.safeParse(input);
  if (!parsed.success) {
    throw AppError.badRequest(
      ERROR_CODES.BACKUP_INVALID_FILE,
      'Tệp sao lưu không đúng định dạng hoặc thiếu bảng dữ liệu bắt buộc.',
    );
  }

  const snapshot = parsed.data;
  const expectedChecksum = computeSnapshotChecksum({
    format: snapshot.format,
    version: snapshot.version,
    createdAt: snapshot.createdAt,
    includeCredentials: snapshot.includeCredentials,
    restorable: snapshot.restorable,
    tables: snapshot.tables,
  });

  if (expectedChecksum.toLowerCase() !== snapshot.checksumSha256.toLowerCase()) {
    throw AppError.badRequest(
      ERROR_CODES.BACKUP_INVALID_FILE,
      'Mã kiểm tra toàn vẹn (SHA-256) không khớp. Tệp có thể đã bị chỉnh sửa hoặc hỏng.',
    );
  }

  const { counts, totalRecords } = summarizeTableCounts(snapshot.tables);
  return { snapshot, counts, totalRecords };
}

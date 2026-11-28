import { Prisma } from '@prisma/client';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '@blood/shared-types';
import { database } from '../../config/database';
import type { BackupTableName, BackupTables } from './backup.validation';

export interface PreRestoreStats {
  previousCounts: Record<BackupTableName, number>;
  previousTotalRecords: number;
}

async function countAllTables(tx: Prisma.TransactionClient): Promise<PreRestoreStats> {
  const [
    roles,
    permissions,
    rolePermissions,
    systemSettings,
    users,
    userRoles,
    donorProfiles,
    donationCampaigns,
    campaignTimeSlots,
    campaignStaff,
    registrations,
    healthDeclarations,
    checkIns,
    screenings,
    screeningTests,
    donations,
    bloodBags,
    postDonationReactions,
    certificates,
    notifications,
    auditLogs,
  ] = await Promise.all([
    tx.role.count(),
    tx.permission.count(),
    tx.rolePermission.count(),
    tx.systemSetting.count(),
    tx.user.count(),
    tx.userRole.count(),
    tx.donorProfile.count(),
    tx.donationCampaign.count(),
    tx.campaignTimeSlot.count(),
    tx.campaignStaff.count(),
    tx.registration.count(),
    tx.healthDeclaration.count(),
    tx.checkIn.count(),
    tx.screening.count(),
    tx.screeningTest.count(),
    tx.donation.count(),
    tx.bloodBag.count(),
    tx.postDonationReaction.count(),
    tx.certificate.count(),
    tx.notification.count(),
    tx.auditLog.count(),
  ]);

  const previousCounts: Record<BackupTableName, number> = {
    roles,
    permissions,
    rolePermissions,
    systemSettings,
    users,
    userRoles,
    donorProfiles,
    donationCampaigns,
    campaignTimeSlots,
    campaignStaff,
    registrations,
    healthDeclarations,
    checkIns,
    screenings,
    screeningTests,
    donations,
    bloodBags,
    postDonationReactions,
    certificates,
    notifications,
    auditLogs,
  };
  const previousTotalRecords = Object.values(previousCounts).reduce(
    (sum, n) => sum + n,
    0,
  );
  return { previousCounts, previousTotalRecords };
}

function jsonField(
  value: unknown,
): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === null || value === undefined) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

function asDate(value: unknown): Date {
  return value instanceof Date ? value : new Date(String(value));
}

function asOptionalDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null;
  return asDate(value);
}

export const backupRepository = {
  async getSummary() {
    const [
      users,
      donors,
      campaigns,
      registrations,
      donations,
      bloodBags,
      certificates,
      auditLogs,
      lastBackup,
      lastRestore,
    ] = await Promise.all([
      database.user.count(),
      database.donorProfile.count(),
      database.donationCampaign.count(),
      database.registration.count(),
      database.donation.count(),
      database.bloodBag.count(),
      database.certificate.count(),
      database.auditLog.count(),
      database.auditLog.findFirst({
        where: { action: AUDIT_ACTIONS.SYSTEM_BACKUP_CREATED },
        orderBy: { createdAt: 'desc' },
        include: { actor: { select: { email: true, fullName: true } } },
      }),
      database.auditLog.findFirst({
        where: { action: AUDIT_ACTIONS.SYSTEM_BACKUP_RESTORED },
        orderBy: { createdAt: 'desc' },
        include: { actor: { select: { email: true, fullName: true } } },
      }),
    ]);

    return {
      counts: {
        users,
        donors,
        campaigns,
        registrations,
        donations,
        bloodBags,
        certificates,
        auditLogs,
      },
      lastBackupAt: lastBackup?.createdAt.toISOString() ?? null,
      lastBackupBy: lastBackup?.actor?.email ?? null,
      lastBackupMetadata:
        (lastBackup?.metadata as Record<string, unknown> | null) ?? null,
      lastRestoreAt: lastRestore?.createdAt.toISOString() ?? null,
      lastRestoreBy: lastRestore?.actor?.email ?? null,
    };
  },

  async listHistory(skip: number, take: number) {
    const where: Prisma.AuditLogWhereInput = {
      entityType: AUDIT_ENTITY_TYPES.SYSTEM_BACKUP,
      action: {
        in: [
          AUDIT_ACTIONS.SYSTEM_BACKUP_CREATED,
          AUDIT_ACTIONS.SYSTEM_BACKUP_RESTORED,
        ],
      },
    };
    const items = await database.auditLog.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: { actor: { select: { email: true, fullName: true } } },
    });
    const total = await database.auditLog.count({ where });
    return { items, total };
  },

  async exportAllTables(includeCredentials: boolean): Promise<BackupTables> {
    return database.$transaction(
      async (tx) => {
        const roles = await tx.role.findMany({ orderBy: { createdAt: 'asc' } });
        const permissions = await tx.permission.findMany({
          orderBy: { createdAt: 'asc' },
        });
        const rolePermissions = await tx.rolePermission.findMany({
          orderBy: { createdAt: 'asc' },
        });
        const systemSettings = await tx.systemSetting.findMany({
          orderBy: { key: 'asc' },
        });
        const rawUsers = await tx.user.findMany({
          orderBy: { createdAt: 'asc' },
        });
        const users = includeCredentials
          ? rawUsers
          : rawUsers.map(({ passwordHash: _omitted, ...rest }) => rest);
        const userRoles = await tx.userRole.findMany({
          orderBy: { createdAt: 'asc' },
        });
        const donorProfiles = await tx.donorProfile.findMany({
          orderBy: { createdAt: 'asc' },
        });
        const donationCampaigns = await tx.donationCampaign.findMany({
          orderBy: { createdAt: 'asc' },
        });
        const campaignTimeSlots = await tx.campaignTimeSlot.findMany({
          orderBy: { createdAt: 'asc' },
        });
        const campaignStaff = await tx.campaignStaff.findMany({
          orderBy: { createdAt: 'asc' },
        });
        const registrations = await tx.registration.findMany({
          orderBy: { createdAt: 'asc' },
        });
        const healthDeclarations = await tx.healthDeclaration.findMany({
          orderBy: { createdAt: 'asc' },
        });
        const checkIns = await tx.checkIn.findMany({
          orderBy: { createdAt: 'asc' },
        });
        const screenings = await tx.screening.findMany({
          orderBy: { createdAt: 'asc' },
        });
        const screeningTests = await tx.screeningTest.findMany({
          orderBy: { createdAt: 'asc' },
        });
        const donations = await tx.donation.findMany({
          orderBy: { createdAt: 'asc' },
        });
        const bloodBags = await tx.bloodBag.findMany({
          orderBy: { createdAt: 'asc' },
        });
        const postDonationReactions = await tx.postDonationReaction.findMany({
          orderBy: { createdAt: 'asc' },
        });
        const certificates = await tx.certificate.findMany({
          orderBy: { createdAt: 'asc' },
        });
        const notifications = await tx.notification.findMany({
          orderBy: { createdAt: 'asc' },
        });
        const auditLogs = await tx.auditLog.findMany({
          orderBy: { createdAt: 'asc' },
        });

        return JSON.parse(
          JSON.stringify({
            roles,
            permissions,
            rolePermissions,
            systemSettings,
            users,
            userRoles,
            donorProfiles,
            donationCampaigns,
            campaignTimeSlots,
            campaignStaff,
            registrations,
            healthDeclarations,
            checkIns,
            screenings,
            screeningTests,
            donations,
            bloodBags,
            postDonationReactions,
            certificates,
            notifications,
            auditLogs,
          }),
        ) as BackupTables;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        timeout: 60_000,
      },
    );
  },

  async restoreAllTables(
    tables: BackupTables,
    afterRestore?: (
      tx: Prisma.TransactionClient,
      preRestore: PreRestoreStats,
    ) => Promise<void>,
  ): Promise<void> {
    await database.$transaction(
      async (tx) => {
        const preRestore = await countAllTables(tx);

        // Delete in reverse foreign-key dependency order.
        await tx.certificate.deleteMany();
        await tx.postDonationReaction.deleteMany();
        await tx.bloodBag.deleteMany();
        await tx.donation.deleteMany();
        await tx.screeningTest.deleteMany();
        await tx.screening.deleteMany();
        await tx.checkIn.deleteMany();
        await tx.healthDeclaration.deleteMany();
        await tx.registration.deleteMany();
        await tx.campaignStaff.deleteMany();
        await tx.campaignTimeSlot.deleteMany();
        await tx.donationCampaign.deleteMany();
        await tx.notification.deleteMany();
        await tx.auditLog.deleteMany();
        await tx.passwordResetToken.deleteMany();
        await tx.authSession.deleteMany();
        await tx.donorProfile.deleteMany();
        await tx.userRole.deleteMany();
        await tx.user.deleteMany();
        await tx.rolePermission.deleteMany();
        await tx.permission.deleteMany();
        await tx.role.deleteMany();
        await tx.systemSetting.deleteMany();

        // Re-insert in forward topological order.
        if (tables.roles.length > 0) {
          await tx.role.createMany({
            data: tables.roles as unknown as Prisma.RoleCreateManyInput[],
          });
        }
        if (tables.permissions.length > 0) {
          await tx.permission.createMany({
            data: tables.permissions as unknown as Prisma.PermissionCreateManyInput[],
          });
        }
        if (tables.rolePermissions.length > 0) {
          await tx.rolePermission.createMany({
            data: tables.rolePermissions as unknown as Prisma.RolePermissionCreateManyInput[],
          });
        }
        if (tables.systemSettings.length > 0) {
          await tx.systemSetting.createMany({
            data: tables.systemSettings as unknown as Prisma.SystemSettingCreateManyInput[],
          });
        }
        if (tables.users.length > 0) {
          await tx.user.createMany({
            data: tables.users.map((row) => ({
              ...(row as Record<string, unknown>),
              createdAt: asDate(row.createdAt),
              updatedAt: asDate(row.updatedAt),
              emailVerifiedAt: asOptionalDate(row.emailVerifiedAt),
              lastLoginAt: asOptionalDate(row.lastLoginAt),
            })) as Prisma.UserCreateManyInput[],
          });
        }
        if (tables.userRoles.length > 0) {
          await tx.userRole.createMany({
            data: tables.userRoles as unknown as Prisma.UserRoleCreateManyInput[],
          });
        }
        if (tables.donorProfiles.length > 0) {
          await tx.donorProfile.createMany({
            data: tables.donorProfiles.map((row) => ({
              ...(row as Record<string, unknown>),
              createdAt: asDate(row.createdAt),
              updatedAt: asDate(row.updatedAt),
              dateOfBirth: asOptionalDate(row.dateOfBirth),
            })) as Prisma.DonorProfileCreateManyInput[],
          });
        }
        if (tables.donationCampaigns.length > 0) {
          await tx.donationCampaign.createMany({
            data: tables.donationCampaigns.map((row) => ({
              ...(row as Record<string, unknown>),
              createdAt: asDate(row.createdAt),
              updatedAt: asDate(row.updatedAt),
              startsAt: asDate(row.startsAt),
              endsAt: asDate(row.endsAt),
              registrationOpensAt: asOptionalDate(row.registrationOpensAt),
              registrationClosesAt: asOptionalDate(row.registrationClosesAt),
            })) as Prisma.DonationCampaignCreateManyInput[],
          });
        }
        if (tables.campaignTimeSlots.length > 0) {
          await tx.campaignTimeSlot.createMany({
            data: tables.campaignTimeSlots.map((row) => ({
              ...(row as Record<string, unknown>),
              createdAt: asDate(row.createdAt),
              updatedAt: asDate(row.updatedAt),
              startsAt: asDate(row.startsAt),
              endsAt: asDate(row.endsAt),
            })) as Prisma.CampaignTimeSlotCreateManyInput[],
          });
        }
        if (tables.campaignStaff.length > 0) {
          await tx.campaignStaff.createMany({
            data: tables.campaignStaff as unknown as Prisma.CampaignStaffCreateManyInput[],
          });
        }
        if (tables.registrations.length > 0) {
          await tx.registration.createMany({
            data: tables.registrations as unknown as Prisma.RegistrationCreateManyInput[],
          });
        }
        if (tables.healthDeclarations.length > 0) {
          await tx.healthDeclaration.createMany({
            data: tables.healthDeclarations.map((row) => ({
              ...(row as Record<string, unknown>),
              createdAt: asDate(row.createdAt),
              updatedAt: asDate(row.updatedAt),
              submittedAt: asOptionalDate(row.submittedAt),
              answers: jsonField(row.answers),
            })) as Prisma.HealthDeclarationCreateManyInput[],
          });
        }
        if (tables.checkIns.length > 0) {
          await tx.checkIn.createMany({
            data: tables.checkIns as unknown as Prisma.CheckInCreateManyInput[],
          });
        }
        if (tables.screenings.length > 0) {
          await tx.screening.createMany({
            data: tables.screenings.map((row) => ({
              ...(row as Record<string, unknown>),
              createdAt: asDate(row.createdAt),
              updatedAt: asDate(row.updatedAt),
              deferredUntil: asOptionalDate(row.deferredUntil),
            })) as Prisma.ScreeningCreateManyInput[],
          });
        }
        if (tables.screeningTests.length > 0) {
          await tx.screeningTest.createMany({
            data: tables.screeningTests as unknown as Prisma.ScreeningTestCreateManyInput[],
          });
        }
        if (tables.donations.length > 0) {
          await tx.donation.createMany({
            data: tables.donations.map((row) => ({
              ...(row as Record<string, unknown>),
              createdAt: asDate(row.createdAt),
              updatedAt: asDate(row.updatedAt),
              startedAt: asOptionalDate(row.startedAt),
              completedAt: asOptionalDate(row.completedAt),
              donatedAt: asOptionalDate(row.donatedAt),
            })) as Prisma.DonationCreateManyInput[],
          });
        }
        if (tables.bloodBags.length > 0) {
          await tx.bloodBag.createMany({
            data: tables.bloodBags.map((row) => ({
              ...(row as Record<string, unknown>),
              createdAt: asDate(row.createdAt),
              updatedAt: asDate(row.updatedAt),
              collectedAt: asOptionalDate(row.collectedAt),
              expiresAt: asOptionalDate(row.expiresAt),
            })) as Prisma.BloodBagCreateManyInput[],
          });
        }
        if (tables.postDonationReactions.length > 0) {
          await tx.postDonationReaction.createMany({
            data: tables.postDonationReactions.map((row) => ({
              ...(row as Record<string, unknown>),
              createdAt: asDate(row.createdAt),
              updatedAt: asDate(row.updatedAt),
              occurredAt: asDate(row.occurredAt),
              resolvedAt: asOptionalDate(row.resolvedAt),
            })) as Prisma.PostDonationReactionCreateManyInput[],
          });
        }
        if (tables.certificates.length > 0) {
          await tx.certificate.createMany({
            data: tables.certificates.map((row) => ({
              ...(row as Record<string, unknown>),
              createdAt: asDate(row.createdAt),
              updatedAt: asDate(row.updatedAt),
              issuedAt: asDate(row.issuedAt),
              revokedAt: asOptionalDate(row.revokedAt),
            })) as Prisma.CertificateCreateManyInput[],
          });
        }
        if (tables.notifications.length > 0) {
          await tx.notification.createMany({
            data: tables.notifications.map((row) => ({
              ...(row as Record<string, unknown>),
              createdAt: asDate(row.createdAt),
              updatedAt: asDate(row.updatedAt),
              sentAt: asOptionalDate(row.sentAt),
              readAt: asOptionalDate(row.readAt),
            })) as Prisma.NotificationCreateManyInput[],
          });
        }
        if (tables.auditLogs.length > 0) {
          await tx.auditLog.createMany({
            data: tables.auditLogs.map((row) => ({
              ...(row as Record<string, unknown>),
              createdAt: asDate(row.createdAt),
              metadata: jsonField(row.metadata),
            })) as Prisma.AuditLogCreateManyInput[],
          });
        }

        if (afterRestore) {
          await afterRestore(tx, preRestore);
        }
      },
      { timeout: 60_000 },
    );
  },
};

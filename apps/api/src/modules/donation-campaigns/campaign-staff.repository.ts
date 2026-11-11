import type { Prisma } from '@prisma/client';
import { database } from '../../config/database';

export const campaignStaffRepository = {
  transaction: <T>(work: (tx: Prisma.TransactionClient) => Promise<T>) =>
    database.$transaction(work),

  listByCampaign: async (campaignId: string) => {
    const rows = await database.campaignStaff.findMany({
      where: { campaignId },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            roles: {
              include: {
                role: { select: { code: true } },
              },
            },
          },
        },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      campaignId: row.campaignId,
      userId: row.userId,
      assignment: row.assignment,
      user: {
        id: row.user.id,
        fullName: row.user.fullName,
        email: row.user.email,
        roles: row.user.roles.map((r) => r.role.code),
      },
    }));
  },

  campaignExistsTx: (tx: Prisma.TransactionClient, campaignId: string) =>
    tx.donationCampaign.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        name: true,
        startsAt: true,
        endsAt: true,
        status: true,
      },
    }),

  findOverlappingAssignmentTx: (
    tx: Prisma.TransactionClient,
    userId: string,
    excludeCampaignId: string,
    startsAt: Date,
    endsAt: Date,
  ) =>
    tx.campaignStaff.findFirst({
      where: {
        userId,
        campaignId: { not: excludeCampaignId },
        campaign: {
          status: { not: 'CANCELLED' },
          startsAt: { lt: endsAt },
          endsAt: { gt: startsAt },
        },
      },
      include: {
        campaign: {
          select: { id: true, name: true, startsAt: true, endsAt: true },
        },
      },
    }),

  /** A user's role codes, to reject assigning a DONOR account as staff. */
  userRoleCodesTx: (tx: Prisma.TransactionClient, userId: string) =>
    tx.userRole
      .findMany({
        where: { userId },
        include: { role: { select: { code: true } } },
      })
      .then((rows) => rows.map((r) => r.role.code)),

  create: async (
    tx: Prisma.TransactionClient,
    data: Prisma.CampaignStaffUncheckedCreateInput,
  ) => {
    const record = await tx.campaignStaff.create({
      data,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            roles: {
              include: {
                role: { select: { code: true } },
              },
            },
          },
        },
      },
    });
    return {
      id: record.id,
      campaignId: record.campaignId,
      userId: record.userId,
      assignment: record.assignment,
      user: {
        id: record.user.id,
        fullName: record.user.fullName,
        email: record.user.email,
        roles: record.user.roles.map((r) => r.role.code),
      },
    };
  },

  findAssignmentTx: (
    tx: Prisma.TransactionClient,
    campaignId: string,
    userOrAssignmentId: string,
  ) =>
    tx.campaignStaff.findFirst({
      where: {
        campaignId,
        OR: [{ userId: userOrAssignmentId }, { id: userOrAssignmentId }],
      },
    }),

  remove: (tx: Prisma.TransactionClient, campaignId: string, userOrAssignmentId: string) =>
    tx.campaignStaff.deleteMany({
      where: {
        campaignId,
        OR: [{ userId: userOrAssignmentId }, { id: userOrAssignmentId }],
      },
    }),
};

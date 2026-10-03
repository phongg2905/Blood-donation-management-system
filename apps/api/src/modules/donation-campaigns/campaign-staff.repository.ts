import type { Prisma } from '@prisma/client';
import { database } from '../../config/database';

export const campaignStaffRepository = {
  transaction: <T>(work: (tx: Prisma.TransactionClient) => Promise<T>) =>
    database.$transaction(work),

  listByCampaign: (campaignId: string) =>
    database.campaignStaff.findMany({
      where: { campaignId },
      include: { user: { select: { id: true, fullName: true, email: true } } },
    }),

  campaignExistsTx: (tx: Prisma.TransactionClient, campaignId: string) =>
    tx.donationCampaign.findUnique({
      where: { id: campaignId },
      select: { id: true },
    }),

  /** A user's role codes, to reject assigning a DONOR account as staff. */
  userRoleCodesTx: (tx: Prisma.TransactionClient, userId: string) =>
    tx.userRole
      .findMany({
        where: { userId },
        include: { role: { select: { code: true } } },
      })
      .then((rows) => rows.map((r) => r.role.code)),

  create: (
    tx: Prisma.TransactionClient,
    data: Prisma.CampaignStaffUncheckedCreateInput,
  ) => tx.campaignStaff.create({ data }),

  findAssignmentTx: (
    tx: Prisma.TransactionClient,
    campaignId: string,
    userId: string,
  ) =>
    tx.campaignStaff.findUnique({
      where: { campaignId_userId: { campaignId, userId } },
    }),

  remove: (tx: Prisma.TransactionClient, campaignId: string, userId: string) =>
    tx.campaignStaff.delete({
      where: { campaignId_userId: { campaignId, userId } },
    }),
};

import { Prisma } from '@prisma/client';
import type { CampaignStatus } from '@blood/shared-types';
import { database } from '../../config/database';

export interface CampaignListFilter {
  status?: CampaignStatus | undefined;
  from?: Date | undefined;
  to?: Date | undefined;
  skip: number;
  take: number;
}

function whereFromFilter(
  filter: Pick<CampaignListFilter, 'status' | 'from' | 'to'>,
): Prisma.DonationCampaignWhereInput {
  return {
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.from || filter.to
      ? {
          startsAt: {
            ...(filter.from ? { gte: filter.from } : {}),
            ...(filter.to ? { lte: filter.to } : {}),
          },
        }
      : {}),
  };
}

export const campaignRepository = {
  /** No capacity-style contention here — a plain transaction is enough. */
  transaction: <T>(work: (tx: Prisma.TransactionClient) => Promise<T>) =>
    database.$transaction(work),

  async list(filter: CampaignListFilter) {
    const where = whereFromFilter(filter);
    const [items, total] = await Promise.all([
      database.donationCampaign.findMany({
        where,
        skip: filter.skip,
        take: filter.take,
        orderBy: { startsAt: 'desc' },
      }),
      database.donationCampaign.count({ where }),
    ]);
    return { items, total };
  },

  findById: (id: string) =>
    database.donationCampaign.findUnique({ where: { id } }),

  findByIdTx: (tx: Prisma.TransactionClient, id: string) =>
    tx.donationCampaign.findUnique({ where: { id } }),

  create: (
    tx: Prisma.TransactionClient,
    data: Prisma.DonationCampaignUncheckedCreateInput,
  ) => tx.donationCampaign.create({ data }),

  update: (
    tx: Prisma.TransactionClient,
    id: string,
    data: Prisma.DonationCampaignUncheckedUpdateInput,
  ) => tx.donationCampaign.update({ where: { id }, data }),
};

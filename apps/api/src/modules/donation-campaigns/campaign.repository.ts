import { Prisma } from '@prisma/client';
import type { CampaignStatus } from '@blood/shared-types';
import { database } from '../../config/database';

export interface CampaignListFilter {
  status?: CampaignStatus | 'UPCOMING' | undefined;
  excludeDraft?: boolean | undefined;
  from?: Date | undefined;
  to?: Date | undefined;
  skip: number;
  take: number;
}

function whereFromFilter(
  filter: Pick<CampaignListFilter, 'status' | 'excludeDraft' | 'from' | 'to'>,
  now: Date = new Date(),
): Prisma.DonationCampaignWhereInput {
  let statusCondition: Prisma.DonationCampaignWhereInput = {};

  if (filter.status === 'UPCOMING') {
    statusCondition = {
      status: 'OPEN',
      registrationOpensAt: { gt: now },
    };
  } else if (filter.status === 'OPEN') {
    statusCondition = {
      status: 'OPEN',
      AND: [
        {
          OR: [
            { registrationOpensAt: null },
            { registrationOpensAt: { lte: now } },
          ],
        },
        {
          OR: [
            { registrationClosesAt: null },
            { registrationClosesAt: { gt: now } },
          ],
        },
      ],
    };
  } else if (filter.status) {
    statusCondition = { status: filter.status };
  } else if (filter.excludeDraft) {
    statusCondition = { status: { not: 'DRAFT' } };
  }

  return {
    ...statusCondition,
    ...(filter.from
      ? {
          endsAt: { gte: filter.from },
        }
      : {}),
    ...(filter.to
      ? {
          startsAt: { lte: filter.to },
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

    if (filter.status) {
      const [items, total] = await Promise.all([
        database.donationCampaign.findMany({
          where,
          skip: filter.skip,
          take: filter.take,
          orderBy: { startsAt: 'asc' },
        }),
        database.donationCampaign.count({ where }),
      ]);
      return { items, total };
    }

    const [openCount, otherCount] = await Promise.all([
      database.donationCampaign.count({
        where: { ...where, status: 'OPEN' },
      }),
      database.donationCampaign.count({
        where: { ...where, status: { not: 'OPEN' } },
      }),
    ]);
    const total = openCount + otherCount;

    let items: any[] = [];
    if (filter.skip < openCount) {
      const openTake = Math.min(filter.take, openCount - filter.skip);
      const openItems = await database.donationCampaign.findMany({
        where: { ...where, status: 'OPEN' },
        skip: filter.skip,
        take: openTake,
        orderBy: { startsAt: 'asc' },
      });
      items.push(...openItems);

      const remainingTake = filter.take - items.length;
      if (remainingTake > 0) {
        const otherItems = await database.donationCampaign.findMany({
          where: { ...where, status: { not: 'OPEN' } },
          skip: 0,
          take: remainingTake,
          orderBy: { startsAt: 'asc' },
        });
        items.push(...otherItems);
      }
    } else {
      const otherSkip = filter.skip - openCount;
      items = await database.donationCampaign.findMany({
        where: { ...where, status: { not: 'OPEN' } },
        skip: otherSkip,
        take: filter.take,
        orderBy: { startsAt: 'asc' },
      });
    }

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

  async syncExpiredCampaigns(now: Date = new Date()): Promise<void> {
    await database.donationCampaign.updateMany({
      where: {
        status: 'OPEN',
        registrationClosesAt: { lte: now },
      },
      data: {
        status: 'CLOSED',
      },
    });
  },
};

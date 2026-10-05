import { z } from 'zod';
import { parseDomain } from '../../common/helpers/domain-validation';
import { database } from '../../config/database';

const querySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  campaignId: z.string().uuid().optional(),
});

export const reportService = {
  async donations(query: unknown) {
    const filter = parseDomain(querySchema, query);
    const where = {
      status: 'COMPLETED' as const,
      ...(filter.from || filter.to
        ? {
            donatedAt: {
              ...(filter.from ? { gte: filter.from } : {}),
              ...(filter.to ? { lte: filter.to } : {}),
            },
          }
        : {}),
      ...(filter.campaignId
        ? {
            screening: {
              checkIn: { registration: { campaignId: filter.campaignId } },
            },
          }
        : {}),
    };
    const [count, volume] = await Promise.all([
      database.donation.count({ where }),
      database.donation.aggregate({ where, _sum: { volumeMl: true } }),
    ]);
    return { totalDonations: count, totalVolumeMl: volume._sum.volumeMl ?? 0 };
  },
};

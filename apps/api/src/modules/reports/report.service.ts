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

    const donations = await database.donation.findMany({
      where,
      include: {
        screening: {
          include: {
            checkIn: {
              include: {
                registration: {
                  include: {
                    campaign: { select: { id: true, name: true } },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { donatedAt: 'desc' },
    });

    const campaigns = await database.donationCampaign.findMany({
      ...(filter.campaignId ? { where: { id: filter.campaignId } } : {}),
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    const campaignStats = new Map<
      string,
      {
        campaignId: string;
        campaignName: string;
        donations: number;
        units: number;
        volumeMl: number;
        donorIds: Set<string>;
      }
    >();

    for (const c of campaigns) {
      campaignStats.set(c.id, {
        campaignId: c.id,
        campaignName: c.name,
        donations: 0,
        units: 0,
        volumeMl: 0,
        donorIds: new Set<string>(),
      });
    }

    let totalVolumeMl = 0;
    const allDonorIds = new Set<string>();

    for (const d of donations) {
      const reg = d.screening?.checkIn?.registration;
      const campaign = reg?.campaign;
      const donorId = reg?.donorId;
      const vol = d.volumeMl ?? 0;
      totalVolumeMl += vol;
      if (donorId) allDonorIds.add(donorId);

      if (campaign) {
        let entry = campaignStats.get(campaign.id);
        if (!entry) {
          entry = {
            campaignId: campaign.id,
            campaignName: campaign.name,
            donations: 0,
            units: 0,
            volumeMl: 0,
            donorIds: new Set<string>(),
          };
          campaignStats.set(campaign.id, entry);
        }
        entry.donations += 1;
        entry.units += 1;
        entry.volumeMl += vol;
        if (donorId) entry.donorIds.add(donorId);
      }
    }

    const rows = Array.from(campaignStats.values()).map((c) => ({
      campaignId: c.campaignId,
      campaignName: c.campaignName,
      donations: c.donations,
      units: c.units,
      volumeMl: c.volumeMl,
      uniqueDonors: c.donorIds.size,
    }));

    const totals = {
      donations: donations.length,
      units: donations.length,
      volumeMl: totalVolumeMl,
      uniqueDonors: allDonorIds.size,
    };

    return {
      rows,
      totals,
      totalDonations: donations.length,
      totalVolumeMl,
    };
  },
};

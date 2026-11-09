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

  async overview() {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const [
      totalDonors,
      completedDonations,
      todayRegistrations,
      acceptedBags,
      recentLogs,
    ] = await Promise.all([
      database.donorProfile.count(),
      database.donation.findMany({
        where: { status: 'COMPLETED' },
        select: { volumeMl: true, donatedAt: true },
      }),
      database.registration.findMany({
        where: {
          timeSlot: {
            startsAt: { gte: startOfDay, lte: endOfDay },
          },
        },
        select: { status: true },
      }),
      database.bloodBag.findMany({
        where: { status: 'ACCEPTED' },
        select: { bloodType: true, volumeMl: true },
      }),
      database.auditLog.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { actor: { select: { fullName: true, email: true } } },
      }),
    ]);

    const totalDonations = completedDonations.length;
    const totalVolumeMl = completedDonations.reduce(
      (sum: number, d: { volumeMl: number | null }) => sum + (d.volumeMl ?? 0),
      0,
    );
    const todayAppointments = todayRegistrations.length;
    const todayCheckedIn = todayRegistrations.filter(
      (r: { status: string }) => r.status === 'COMPLETED' || r.status === 'CONFIRMED',
    ).length;

    const ALL_BLOOD_TYPES = [
      'A_POSITIVE',
      'A_NEGATIVE',
      'B_POSITIVE',
      'B_NEGATIVE',
      'AB_POSITIVE',
      'AB_NEGATIVE',
      'O_POSITIVE',
      'O_NEGATIVE',
    ] as const;

    const BLOOD_TYPE_LABELS: Record<string, string> = {
      A_POSITIVE: 'A+',
      A_NEGATIVE: 'A-',
      B_POSITIVE: 'B+',
      B_NEGATIVE: 'B-',
      AB_POSITIVE: 'AB+',
      AB_NEGATIVE: 'AB-',
      O_POSITIVE: 'O+',
      O_NEGATIVE: 'O-',
    };

    const bagCountMap = new Map<string, { units: number; volumeMl: number }>();
    for (const bt of ALL_BLOOD_TYPES) {
      bagCountMap.set(bt, { units: 0, volumeMl: 0 });
    }
    for (const bag of acceptedBags) {
      if (bag.bloodType) {
        const item = bagCountMap.get(bag.bloodType);
        if (item) {
          item.units += 1;
          item.volumeMl += bag.volumeMl ?? 0;
        }
      }
    }

    const inventory = ALL_BLOOD_TYPES.map((bt) => {
      const data = bagCountMap.get(bt) ?? { units: 0, volumeMl: 0 };
      const targetUnits = 50;
      const percentage = Math.min(
        100,
        Math.round((data.units / targetUnits) * 100),
      );
      let status: 'safe' | 'warning' | 'critical' | 'purple' = 'safe';
      if (percentage < 25) status = 'critical';
      else if (percentage < 55) status = 'warning';
      else if (bt.includes('NEGATIVE')) status = 'purple';

      return {
        bloodType: bt,
        label: BLOOD_TYPE_LABELS[bt] || bt,
        units: data.units,
        volumeMl: data.volumeMl,
        percentage,
        status,
      };
    });

    const monthlyTrend: { month: string; donations: number; volumeMl: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextD = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const mDonations = completedDonations.filter((cd: { donatedAt: Date | null; volumeMl: number | null }) => {
        if (!cd.donatedAt) return false;
        const dt = new Date(cd.donatedAt);
        return dt >= d && dt < nextD;
      });
      monthlyTrend.push({
        month: `T${d.getMonth() + 1}`,
        donations: mDonations.length,
        volumeMl: mDonations.reduce((sum: number, item: { volumeMl: number | null }) => sum + (item.volumeMl ?? 0), 0),
      });
    }

    const recentActivities = recentLogs.map((log: {
      id: string;
      action: string;
      entityType: string;
      createdAt: Date;
      actor: { fullName: string | null; email: string } | null;
    }) => ({
      id: log.id,
      action: log.action,
      entityType: log.entityType,
      createdAt: log.createdAt.toISOString(),
      actor: log.actor?.fullName || log.actor?.email || 'Hệ thống',
    }));

    return {
      kpi: {
        totalDonors,
        totalDonations,
        totalVolumeMl,
        todayAppointments,
        todayCheckedIn,
        safeInventoryDays: Math.max(1, Math.round(acceptedBags.length / 8)),
      },
      inventory,
      monthlyTrend,
      recentActivities,
    };
  },
};

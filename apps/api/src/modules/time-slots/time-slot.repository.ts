import { Prisma } from '@prisma/client';
import { database } from '../../config/database';

export const timeSlotRepository = {
  async transaction<T>(
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await database.$transaction(work, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 10_000,
          timeout: 10_000,
        });
      } catch (error) {
        if (
          !(error instanceof Prisma.PrismaClientKnownRequestError) ||
          error.code !== 'P2034' ||
          attempt >= 2
        )
          throw error;
      }
    }
  },
  campaign: (tx: Prisma.TransactionClient, id: string) =>
    tx.donationCampaign.findUnique({ where: { id } }),
  slot: (tx: Prisma.TransactionClient, id: string) =>
    tx.campaignTimeSlot.findUnique({
      where: { id },
      include: { campaign: true },
    }),
  registration: (tx: Prisma.TransactionClient, id: string) =>
    tx.registration.findUnique({
      where: { id },
      include: { checkIn: true, donor: true },
    }),
  create: (
    tx: Prisma.TransactionClient,
    data: Prisma.CampaignTimeSlotUncheckedCreateInput,
  ) => tx.campaignTimeSlot.create({ data }),
  listByCampaign: (campaignId: string, activeOnly: boolean) =>
    database.campaignTimeSlot.findMany({
      where: { campaignId, ...(activeOnly ? { isActive: true } : {}) },
      include: {
        _count: {
          select: {
            registrations: {
              where: {
                status: { notIn: ['CANCELLED', 'WAITLISTED'] },
              },
            },
          },
        },
      },
      orderBy: { startsAt: 'asc' },
    }),
  findById: (id: string) =>
    database.campaignTimeSlot.findUnique({
      where: { id },
      include: { campaign: true },
    }),
  update: (
    tx: Prisma.TransactionClient,
    id: string,
    data: Prisma.CampaignTimeSlotUncheckedUpdateInput,
  ) => tx.campaignTimeSlot.update({ where: { id }, data }),
  occupied: (
    tx: Prisma.TransactionClient,
    slotId: string,
    excludeRegistrationId: string,
  ) =>
    tx.registration.count({
      where: {
        timeSlotId: slotId,
        id: { not: excludeRegistrationId },
        status: { notIn: ['CANCELLED', 'WAITLISTED'] },
      },
    }),
  /**
   * Other active schedules of the same donor, used to reject overlapping
   * bookings. CANCELLED and WAITLISTED registrations hold no place.
   */
  overlappingSchedules: (
    tx: Prisma.TransactionClient,
    donorId: string,
    excludeRegistrationId: string,
    startsAt: Date,
    endsAt: Date,
  ) =>
    tx.registration.findMany({
      where: {
        donorId,
        id: { not: excludeRegistrationId },
        status: { notIn: ['CANCELLED', 'WAITLISTED'] },
        timeSlot: { startsAt: { lt: endsAt }, endsAt: { gt: startsAt } },
      },
      select: { timeSlot: { select: { startsAt: true, endsAt: true } } },
    }),
  duplicateWindowTx: (
    tx: Prisma.TransactionClient,
    campaignId: string,
    startsAt: Date,
    endsAt: Date,
    excludeSlotId?: string,
  ) =>
    tx.campaignTimeSlot.findFirst({
      where: {
        campaignId,
        startsAt,
        endsAt,
        ...(excludeSlotId ? { id: { not: excludeSlotId } } : {}),
      },
    }),
  activeDeferralTx: (
    tx: Prisma.TransactionClient,
    donorId: string,
    atDate: Date,
  ) =>
    tx.screening.findFirst({
      where: {
        status: 'DEFERRED',
        deferredUntil: { gt: atDate },
        checkIn: { registration: { donorId } },
      },
      orderBy: { deferredUntil: 'desc' },
    }),
  recentCompletedDonationTx: (
    tx: Prisma.TransactionClient,
    donorId: string,
    targetDate: Date,
  ) => {
    const windowMs = 84 * 24 * 60 * 60 * 1000;
    const minDate = new Date(targetDate.getTime() - windowMs);
    const maxDate = new Date(targetDate.getTime() + windowMs);
    return tx.donation.findFirst({
      where: {
        status: 'COMPLETED',
        donatedAt: { gt: minDate, lt: maxDate },
        screening: { checkIn: { registration: { donorId } } },
      },
      orderBy: { donatedAt: 'desc' },
    });
  },
  activeRegistrationsWithinIntervalTx: (
    tx: Prisma.TransactionClient,
    donorId: string,
    excludeRegistrationId: string,
    targetDate: Date,
  ) => {
    const windowMs = 84 * 24 * 60 * 60 * 1000;
    const minDate = new Date(targetDate.getTime() - windowMs);
    const maxDate = new Date(targetDate.getTime() + windowMs);
    return tx.registration.findFirst({
      where: {
        donorId,
        id: { not: excludeRegistrationId },
        status: { in: ['PENDING', 'SCHEDULED', 'CONFIRMED'] },
        campaign: {
          status: { not: 'CANCELLED' },
          startsAt: { gt: minDate, lt: maxDate },
        },
      },
      include: {
        campaign: { select: { id: true, name: true, startsAt: true } },
      },
    });
  },
  schedule: (
    tx: Prisma.TransactionClient,
    id: string,
    timeSlotId: string,
    status: Prisma.RegistrationUpdateInput['status'],
  ) =>
    tx.registration.update({
      where: { id },
      data: { timeSlotId, status },
    }),
};

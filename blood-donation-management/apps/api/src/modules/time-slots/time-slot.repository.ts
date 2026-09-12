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
    tx.registration.findUnique({ where: { id }, include: { checkIn: true } }),
  create: (
    tx: Prisma.TransactionClient,
    data: Prisma.CampaignTimeSlotUncheckedCreateInput,
  ) => tx.campaignTimeSlot.create({ data }),
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
  schedule: (tx: Prisma.TransactionClient, id: string, timeSlotId: string) =>
    tx.registration.update({
      where: { id },
      data: { timeSlotId, status: 'SCHEDULED' },
    }),
};

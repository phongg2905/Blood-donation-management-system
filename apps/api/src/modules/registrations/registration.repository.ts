import type { Prisma } from '@prisma/client';
import { database } from '../../config/database';

export const registrationRepository = {
  transaction: <T>(work: (tx: Prisma.TransactionClient) => Promise<T>) =>
    database.$transaction(work),

  donorProfileByUserId: (tx: Prisma.TransactionClient, userId: string) =>
    tx.donorProfile.findUnique({ where: { userId } }),

  findByDonorAndCampaign: (
    tx: Prisma.TransactionClient,
    donorId: string,
    campaignId: string,
  ) =>
    tx.registration.findUnique({
      where: { donorId_campaignId: { donorId, campaignId } },
    }),

  findById: (id: string) =>
    database.registration.findUnique({
      where: { id },
      include: { healthDeclaration: true, checkIn: true },
    }),

  findByIdTx: (tx: Prisma.TransactionClient, id: string) =>
    tx.registration.findUnique({ where: { id } }),

  create: (
    tx: Prisma.TransactionClient,
    data: Prisma.RegistrationUncheckedCreateInput,
  ) => tx.registration.create({ data }),

  reuse: (
    tx: Prisma.TransactionClient,
    id: string,
    data: Prisma.RegistrationUncheckedUpdateInput,
  ) => tx.registration.update({ where: { id }, data }),

  createHealthDeclaration: (
    tx: Prisma.TransactionClient,
    data: Prisma.HealthDeclarationUncheckedCreateInput,
  ) => tx.healthDeclaration.create({ data }),

  update: (
    tx: Prisma.TransactionClient,
    id: string,
    data: Prisma.RegistrationUncheckedUpdateInput,
  ) => tx.registration.update({ where: { id }, data }),
};

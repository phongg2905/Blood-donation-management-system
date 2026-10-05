import type { Prisma, RegistrationStatus } from '@prisma/client';
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
      include: {
        healthDeclaration: true,
        checkIn: true,
        donor: { select: { userId: true } },
      },
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

  async search(filter: {
    search?: string | undefined;
    status?: string | undefined;
    campaignId?: string | undefined;
    skip: number;
    take: number;
  }) {
    const where: Prisma.RegistrationWhereInput = {
      ...(filter.status ? { status: filter.status as RegistrationStatus } : {}),
      ...(filter.campaignId ? { campaignId: filter.campaignId } : {}),
      ...(filter.search
        ? {
            donor: {
              OR: [
                { citizenId: { contains: filter.search } },
                { phone: { contains: filter.search } },
                {
                  user: {
                    fullName: { contains: filter.search, mode: 'insensitive' },
                  },
                },
                {
                  user: {
                    email: { contains: filter.search, mode: 'insensitive' },
                  },
                },
              ],
            },
          }
        : {}),
    };
    const include = {
      donor: { include: { user: { select: { fullName: true, email: true } } } },
    };
    const [items, total] = await Promise.all([
      database.registration.findMany({
        where,
        include,
        skip: filter.skip,
        take: filter.take,
        orderBy: { createdAt: 'desc' },
      }),
      database.registration.count({ where }),
    ]);
    return { items, total };
  },

  async listByDonor(donorId: string, skip: number, take: number) {
    const where: Prisma.RegistrationWhereInput = { donorId };
    const [items, total] = await Promise.all([
      database.registration.findMany({
        where,
        include: { healthDeclaration: true, checkIn: true },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      database.registration.count({ where }),
    ]);
    return { items, total };
  },
};

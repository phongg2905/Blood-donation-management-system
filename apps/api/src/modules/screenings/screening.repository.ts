import type { Prisma } from '@prisma/client';
import { database } from '../../config/database';

export const screeningRepository = {
  transaction: <T>(work: (tx: Prisma.TransactionClient) => Promise<T>) =>
    database.$transaction(work),

  findCheckInTx: (tx: Prisma.TransactionClient, checkInId: string) =>
    tx.checkIn.findUnique({
      where: { id: checkInId },
      include: { screening: true },
    }),

  create: (
    tx: Prisma.TransactionClient,
    data: Prisma.ScreeningUncheckedCreateInput,
  ) => tx.screening.create({ data }),

  createTests: (
    tx: Prisma.TransactionClient,
    rows: Prisma.ScreeningTestUncheckedCreateInput[],
  ) => tx.screeningTest.createMany({ data: rows }),

  findByIdTx: (tx: Prisma.TransactionClient, id: string) =>
    tx.screening.findUnique({ where: { id } }),

  findById: (id: string) =>
    database.screening.findUnique({ where: { id }, include: { tests: true } }),

  update: (
    tx: Prisma.TransactionClient,
    id: string,
    data: Prisma.ScreeningUncheckedUpdateInput,
  ) => tx.screening.update({ where: { id }, data }),
};

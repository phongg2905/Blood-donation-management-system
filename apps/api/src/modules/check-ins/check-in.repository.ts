import type { Prisma } from '@prisma/client';
import { database } from '../../config/database';

export const checkInRepository = {
  transaction: <T>(work: (tx: Prisma.TransactionClient) => Promise<T>) =>
    database.$transaction(work),

  findRegistrationTx: (tx: Prisma.TransactionClient, id: string) =>
    tx.registration.findUnique({ where: { id }, include: { checkIn: true } }),

  create: (
    tx: Prisma.TransactionClient,
    data: Prisma.CheckInUncheckedCreateInput,
  ) => tx.checkIn.create({ data }),

  markNoShow: (tx: Prisma.TransactionClient, id: string) =>
    tx.registration.update({ where: { id }, data: { status: 'NO_SHOW' } }),
};

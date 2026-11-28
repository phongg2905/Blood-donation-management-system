import type { Prisma } from '@prisma/client';
import { serializableTransaction } from '../../config/database';

export const checkInRepository = {
  transaction: serializableTransaction,

  findRegistrationTx: (tx: Prisma.TransactionClient, id: string) =>
    tx.registration.findUnique({
      where: { id },
      include: {
        checkIn: true,
        donor: { select: { userId: true } },
        campaign: { select: { id: true, status: true } },
        healthDeclaration: { select: { id: true } },
      },
    }),

  create: (
    tx: Prisma.TransactionClient,
    data: Prisma.CheckInUncheckedCreateInput,
  ) => tx.checkIn.create({ data }),

  markCheckedIn: (tx: Prisma.TransactionClient, id: string) =>
    tx.registration.update({ where: { id }, data: { status: 'CONFIRMED' } }),

  markNoShow: (tx: Prisma.TransactionClient, id: string) =>
    tx.registration.update({ where: { id }, data: { status: 'NO_SHOW' } }),
};

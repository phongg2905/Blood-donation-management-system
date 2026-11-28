import type { Prisma } from '@prisma/client';
import { database } from '../../config/database';

export const notificationRepository = {
  create: (
    tx: Prisma.TransactionClient | typeof database,
    data: Prisma.NotificationUncheckedCreateInput,
  ) => tx.notification.create({ data }),

  markSent: (id: string) =>
    database.notification.update({
      where: { id },
      data: { status: 'SENT', sentAt: new Date() },
    }),
  markFailed: (id: string) =>
    database.notification.update({ where: { id }, data: { status: 'FAILED' } }),

  listByUser: async (userId: string, skip: number, take: number) => {
    const items = await database.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      });
    const total = await database.notification.count({ where: { userId } });
    return [items, total] as const;
  },

  markRead: (id: string, userId: string) =>
    database.notification.updateMany({
      where: { id, userId },
      data: { readAt: new Date() },
    }),
};

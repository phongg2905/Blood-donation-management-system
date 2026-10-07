import type { Prisma } from '@prisma/client';
import { database } from '../../config/database';

export const userRepository = {
  async list(filter: {
    search?: string | undefined;
    role?: string | undefined;
    skip: number;
    take: number;
  }) {
    const where: Prisma.UserWhereInput = {
      ...(filter.search
        ? {
            OR: [
              { fullName: { contains: filter.search, mode: 'insensitive' } },
              { email: { contains: filter.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(filter.role
        ? { roles: { some: { role: { code: filter.role } } } }
        : {}),
    };
    const include = {
      roles: { include: { role: { select: { code: true, name: true } } } },
    };
    const [items, total] = await Promise.all([
      database.user.findMany({
        where,
        include,
        skip: filter.skip,
        take: filter.take,
        orderBy: { createdAt: 'desc' },
      }),
      database.user.count({ where }),
    ]);
    return { items, total };
  },

  findByIdTx: (tx: Prisma.TransactionClient, id: string) =>
    tx.user.findUnique({ where: { id } }),

  findRoleByIdTx: (tx: Prisma.TransactionClient, roleId: string) =>
    tx.role.findUnique({ where: { id: roleId } }),

  assignRoleTx: (
    tx: Prisma.TransactionClient,
    userId: string,
    roleId: string,
  ) =>
    tx.userRole.upsert({
      where: { userId_roleId: { userId, roleId } },
      create: { userId, roleId },
      update: {},
    }),

  transaction: <T>(work: (tx: Prisma.TransactionClient) => Promise<T>) =>
    database.$transaction(work),
};

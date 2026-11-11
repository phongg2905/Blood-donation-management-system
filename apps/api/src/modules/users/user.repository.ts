import type { BloodType, Gender, Prisma } from '@prisma/client';
import { database } from '../../config/database';

const userInclude = {
  roles: { include: { role: { select: { code: true, name: true } } } },
  donorProfile: {
    select: {
      phone: true,
      citizenId: true,
      dateOfBirth: true,
      gender: true,
      bloodType: true,
      address: true,
      emergencyName: true,
      emergencyPhone: true,
    },
  },
  campaignAssignments: {
    include: {
      campaign: {
        select: {
          id: true,
          name: true,
          startsAt: true,
          status: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' as const },
  },
} satisfies Prisma.UserInclude;

export const userRepository = {
  async list(filter: {
    search?: string | undefined;
    role?: string | undefined;
    isActive?: boolean | undefined;
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
      ...(typeof filter.isActive === 'boolean'
        ? { isActive: filter.isActive }
        : {}),
    };
    const [items, total] = await Promise.all([
      database.user.findMany({
        where,
        include: userInclude,
        skip: filter.skip,
        take: filter.take,
        orderBy: { createdAt: 'desc' },
      }),
      database.user.count({ where }),
    ]);
    return { items, total };
  },

  findByIdTx: (tx: Prisma.TransactionClient, id: string) =>
    tx.user.findUnique({ where: { id }, include: { donorProfile: true } }),

  findByEmailTx: (tx: Prisma.TransactionClient, email: string) =>
    tx.user.findUnique({ where: { email } }),

  findDonorByCitizenIdTx: (tx: Prisma.TransactionClient, citizenId: string) =>
    tx.donorProfile.findUnique({ where: { citizenId } }),

  findRoleByIdTx: (tx: Prisma.TransactionClient, roleId: string) =>
    tx.role.findUnique({ where: { id: roleId } }),

  findRolesByCodesTx: (
    tx: Prisma.TransactionClient,
    codes: readonly string[],
  ) =>
    tx.role.findMany({
      where: { code: { in: [...codes] } },
      select: { id: true, code: true, name: true },
    }),

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

  setRolesTx: async (
    tx: Prisma.TransactionClient,
    userId: string,
    roleIds: readonly string[],
  ) => {
    await tx.userRole.deleteMany({
      where: {
        userId,
        roleId: { notIn: [...roleIds] },
      },
    });
    if (roleIds.length > 0) {
      await tx.userRole.createMany({
        data: roleIds.map((roleId) => ({ userId, roleId })),
        skipDuplicates: true,
      });
    }
    return tx.user.findUniqueOrThrow({
      where: { id: userId },
      include: userInclude,
    });
  },

  updateTx: async (
    tx: Prisma.TransactionClient,
    id: string,
    data: {
      fullName?: string | undefined;
      email?: string | undefined;
      isActive?: boolean | undefined;
      donorProfile?:
        | {
            phone?: string | null | undefined;
            citizenId?: string | null | undefined;
            dateOfBirth?: Date | null | undefined;
            gender?: Gender | null | undefined;
            bloodType?: BloodType | null | undefined;
            address?: string | null | undefined;
          }
        | undefined;
    },
  ) => {
    const { donorProfile, ...userData } = data;
    const cleanUserData: Prisma.UserUpdateInput = {
      ...(userData.fullName !== undefined ? { fullName: userData.fullName } : {}),
      ...(userData.email !== undefined ? { email: userData.email } : {}),
      ...(userData.isActive !== undefined ? { isActive: userData.isActive } : {}),
    };
    if (donorProfile) {
      const profileFields = {
        ...(donorProfile.phone !== undefined ? { phone: donorProfile.phone } : {}),
        ...(donorProfile.citizenId !== undefined
          ? { citizenId: donorProfile.citizenId }
          : {}),
        ...(donorProfile.dateOfBirth !== undefined
          ? { dateOfBirth: donorProfile.dateOfBirth }
          : {}),
        ...(donorProfile.gender !== undefined ? { gender: donorProfile.gender } : {}),
        ...(donorProfile.bloodType !== undefined
          ? { bloodType: donorProfile.bloodType }
          : {}),
        ...(donorProfile.address !== undefined
          ? { address: donorProfile.address }
          : {}),
      };
      cleanUserData.donorProfile = {
        upsert: {
          create: profileFields,
          update: profileFields,
        },
      };
    }
    return tx.user.update({
      where: { id },
      data: cleanUserData,
      include: userInclude,
    });
  },

  transaction: <T>(work: (tx: Prisma.TransactionClient) => Promise<T>) =>
    database.$transaction(work),
};

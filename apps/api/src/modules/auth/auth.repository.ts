import type { Prisma, User } from '@prisma/client';
import type { PermissionCode, RoleCode } from '@blood/shared-types';
import { database } from '../../config/database';

export interface UserWithAccess extends User {
  donorProfile: { phone: string | null; address: string | null } | null;
  roleCodes: RoleCode[];
  permissionCodes: PermissionCode[];
}

const withAccessInclude = {
  donorProfile: { select: { phone: true, address: true } },
  roles: {
    include: {
      role: { include: { permissions: { include: { permission: true } } } },
    },
  },
} satisfies Prisma.UserInclude;

type UserWithRoles = Prisma.UserGetPayload<{
  include: typeof withAccessInclude;
}>;

function toUserWithAccess(user: UserWithRoles): UserWithAccess {
  const roleCodes: RoleCode[] = [];
  const permissionSet = new Set<PermissionCode>();
  for (const userRole of user.roles) {
    roleCodes.push(userRole.role.code as RoleCode);
    for (const rolePermission of userRole.role.permissions) {
      permissionSet.add(rolePermission.permission.code as PermissionCode);
    }
  }
  return { ...user, roleCodes, permissionCodes: [...permissionSet] };
}

// Security mutations for one account share this lock, including reset versus
// refresh/login. Parameter binding keeps the UUID out of the SQL source.
async function lockUser(tx: Prisma.TransactionClient, userId: string) {
  await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId}::uuid FOR UPDATE`;
}

export const authRepository = {
  async findByEmailWithAccess(email: string): Promise<UserWithAccess | null> {
    const user = await database.user.findUnique({
      where: { email },
      include: withAccessInclude,
    });
    return user ? toUserWithAccess(user) : null;
  },

  async findByIdWithAccess(id: string): Promise<UserWithAccess | null> {
    const user = await database.user.findUnique({
      where: { id },
      include: withAccessInclude,
    });
    return user ? toUserWithAccess(user) : null;
  },

  findDonorRole(): Promise<{ id: string } | null> {
    return database.role.findUnique({
      where: { code: 'DONOR' },
      select: { id: true },
    });
  },

  /** Creates the user, assigns DONOR and stubs an empty DonorProfile in one transaction. */
  createDonor(input: {
    email: string;
    passwordHash: string;
    fullName: string;
    phone?: string | undefined;
    donorRoleId: string;
  }): Promise<User> {
    return database.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: input.email,
          passwordHash: input.passwordHash,
          fullName: input.fullName,
          isActive: true,
        },
      });
      await tx.userRole.create({
        data: { userId: user.id, roleId: input.donorRoleId },
      });
      await tx.donorProfile.create({
        data: { userId: user.id, phone: input.phone ?? null },
      });
      return user;
    });
  },

  updateProfile(
    userId: string,
    input: { fullName?: string | undefined; phone?: string | undefined; address?: string | undefined },
  ): Promise<UserWithAccess> {
    return database.$transaction(async (tx) => {
      await lockUser(tx, userId);
      if (input.fullName !== undefined) {
        await tx.user.update({ where: { id: userId }, data: { fullName: input.fullName } });
      }
      if (input.phone !== undefined || input.address !== undefined) {
        await tx.donorProfile.upsert({
        where: { userId },
        create: {
          userId,
          phone: input.phone ?? null,
          address: input.address ?? null,
        },
        update: {
          ...(input.phone !== undefined ? { phone: input.phone } : {}),
          ...(input.address !== undefined ? { address: input.address } : {}),
        },
        });
      }
      return toUserWithAccess(await tx.user.findUniqueOrThrow({ where: { id: userId }, include: withAccessInclude }));
    });
  },

  touchLastLogin(userId: string): Promise<User> {
    return database.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
  },

  // --- AuthSession (refresh tokens) --------------------------------------

  createSession(input: {
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    ipAddress: string | null;
    userAgent: string | null;
  }, expectedPasswordHash: string | null): Promise<{ id: string } | null> {
    return database.$transaction(async (tx) => {
      await lockUser(tx, input.userId);
      const user = await tx.user.findUnique({ where: { id: input.userId } });
      if (!user?.isActive || user.passwordHash !== expectedPasswordHash) return null;
      return tx.authSession.create({
      data: {
        id: input.id,
        userId: input.userId,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
      select: { id: true },
      });
    });
  },

  findSessionById(id: string) {
    return database.authSession.findUnique({ where: { id } });
  },

  /**
   * Rotation: revoke the used session and chain it to its replacement via
   * `replacedById`, so a replayed old refresh token is detectable even after
   * the chain has moved on.
   */
  async rotateSession(
    oldSessionId: string,
    next: {
      id: string;
      userId: string;
      tokenHash: string;
      expiresAt: Date;
      ipAddress: string | null;
      userAgent: string | null;
    },
  ): Promise<boolean> {
    return database.$transaction(async (tx) => {
      await lockUser(tx, next.userId);
      const claimed = await tx.authSession.updateMany({
        where: { id: oldSessionId, userId: next.userId, revokedAt: null, expiresAt: { gt: new Date() } },
        data: { revokedAt: new Date(), replacedById: next.id },
      });
      if (claimed.count !== 1) return false;
      await tx.authSession.create({ data: next });
      return true;
    });
  },

  revokeSession(id: string): Promise<void> {
    return database.authSession
      .updateMany({ where: { id, revokedAt: null }, data: { revokedAt: new Date() } })
      .then(() => undefined);
  },

  /** Replay defence: a refresh token reused after rotation revokes the whole chain. */
  revokeAllSessionsForUser(userId: string): Promise<Prisma.BatchPayload> {
    return database.$transaction(async (tx) => {
      await lockUser(tx, userId);
      return tx.authSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
      });
    });
  },

  // --- PasswordResetToken --------------------------------------------------

  createResetToken(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<{ id: string }> {
    return database.$transaction(async (tx) => {
      await lockUser(tx, input.userId);
      await tx.passwordResetToken.updateMany({ where: { userId: input.userId, usedAt: null }, data: { usedAt: new Date() } });
      return tx.passwordResetToken.create({ data: input, select: { id: true } });
    });
  },

  findResetTokenByHash(tokenHash: string) {
    return database.passwordResetToken.findUnique({ where: { tokenHash } });
  },

  invalidateResetToken(id: string): Promise<void> {
    return database.passwordResetToken
      .update({ where: { id }, data: { usedAt: new Date() } })
      .then(() => undefined);
  },

  /** Consume once, change password and revoke refresh sessions atomically. */
  consumeResetToken(id: string, userId: string, passwordHash: string): Promise<boolean> {
    return database.$transaction(async (tx) => {
      await lockUser(tx, userId);
      const claimed = await tx.passwordResetToken.updateMany({
        where: { id, userId, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      if (claimed.count !== 1) return false;
      await tx.user.update({ where: { id: userId }, data: { passwordHash } });
      await tx.authSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.passwordResetToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } });
      return true;
    });
  },
};

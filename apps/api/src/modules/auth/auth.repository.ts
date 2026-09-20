import type { Prisma, User } from '@prisma/client';
import type { PermissionCode, RoleCode } from '@blood/shared-types';
import { database } from '../../config/database';

export interface UserWithAccess extends User {
  roleCodes: RoleCode[];
  permissionCodes: PermissionCode[];
}

const withAccessInclude = {
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

  updateFullName(userId: string, fullName: string): Promise<User> {
    return database.user.update({ where: { id: userId }, data: { fullName } });
  },

  upsertDonorProfileContact(
    userId: string,
    input: { phone?: string | undefined; address?: string | undefined },
  ): Promise<void> {
    return database.donorProfile
      .upsert({
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
      })
      .then(() => undefined);
  },

  touchLastLogin(userId: string): Promise<User> {
    return database.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
  },

  updatePasswordHash(userId: string, passwordHash: string): Promise<User> {
    return database.user.update({
      where: { id: userId },
      data: { passwordHash },
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
  }): Promise<{ id: string }> {
    return database.authSession.create({
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
  ): Promise<void> {
    await database.$transaction([
      database.authSession.create({
        data: {
          id: next.id,
          userId: next.userId,
          tokenHash: next.tokenHash,
          expiresAt: next.expiresAt,
          ipAddress: next.ipAddress,
          userAgent: next.userAgent,
        },
      }),
      database.authSession.update({
        where: { id: oldSessionId },
        data: { revokedAt: new Date(), replacedById: next.id },
      }),
    ]);
  },

  revokeSession(id: string): Promise<void> {
    return database.authSession
      .update({ where: { id }, data: { revokedAt: new Date() } })
      .then(() => undefined)
      .catch(() => undefined); // already gone/revoked — logout stays idempotent
  },

  /** Replay defence: a refresh token reused after rotation revokes the whole chain. */
  revokeAllSessionsForUser(userId: string): Promise<Prisma.BatchPayload> {
    return database.authSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },

  // --- PasswordResetToken --------------------------------------------------

  createResetToken(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<{ id: string }> {
    return database.passwordResetToken.create({
      data: input,
      select: { id: true },
    });
  },

  findResetTokenByHash(tokenHash: string) {
    return database.passwordResetToken.findUnique({ where: { tokenHash } });
  },

  markResetTokenUsed(id: string): Promise<void> {
    return database.passwordResetToken
      .update({ where: { id }, data: { usedAt: new Date() } })
      .then(() => undefined);
  },

  /** Invalidates any earlier unused reset tokens when a new one is requested. */
  invalidateActiveResetTokens(userId: string): Promise<Prisma.BatchPayload> {
    return database.passwordResetToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    });
  },
};

import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  ERROR_CODES,
  type CurrentUser,
} from '@blood/shared-types';
import { AppError } from '../../common/errors/app.error';
import {
  generateOpaqueToken,
  hashOpaqueToken,
  hashPassword,
  verifyPassword,
} from '../../common/security/password';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../../common/security/jwt';
import { authConfig } from '../../config/auth.config';
import { database } from '../../config/database';
import { auditLogService } from '../audit-logs/audit.service';
import { authRepository, type UserWithAccess } from './auth.repository';
import { passwordResetMailer } from './password-reset.mailer';
import {
  validateForgotPassword,
  validateLogin,
  validateRegister,
  validateResetPassword,
  validateUpdateMe,
} from './auth.validation';

export interface RequestContext {
  ipAddress: string | null;
  userAgent: string | null;
}

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}

export interface AuthResult {
  tokens: SessionTokens;
  user: CurrentUser;
}

const toCurrentUser = (user: UserWithAccess): CurrentUser => ({
  id: user.id,
  email: user.email,
  fullName: user.fullName,
  phone: user.donorProfile?.phone ?? null,
  address: user.donorProfile?.address ?? null,
  roles: user.roleCodes,
  permissions: user.permissionCodes,
});

async function issueSession(
  user: UserWithAccess,
  ctx: RequestContext,
): Promise<SessionTokens> {
  const sessionId = randomUUID();
  const refreshToken = signRefreshToken({ sub: user.id, sid: sessionId });
  const refreshExpiresAt = new Date(
    Date.now() + authConfig.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
  );
  const session = await authRepository.createSession({
    id: sessionId,
    userId: user.id,
    tokenHash: hashOpaqueToken(refreshToken),
    expiresAt: refreshExpiresAt,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  }, user.passwordHash);
  if (!session) throw AppError.unauthorized(ERROR_CODES.AUTH_SESSION_INVALID);
  const accessToken = signAccessToken({
    sub: user.id,
    roles: user.roleCodes,
    permissions: user.permissionCodes,
  });
  return { accessToken, refreshToken, refreshExpiresAt };
}

export const authService = {
  /**
   * Public self-registration. Only ever creates a DONOR — STAFF/ADMIN
   * accounts are provisioned by an admin (Phase 8), never through this
   * endpoint. See the Phase 2 auth contract for the public DONOR flow.
   */
  async register(input: unknown, ctx: RequestContext): Promise<AuthResult> {
    const data = validateRegister(input);

    const existing = await authRepository.findByEmailWithAccess(data.email);
    if (existing) throw AppError.conflict(ERROR_CODES.AUTH_EMAIL_EXISTS);

    const donorRole = await authRepository.findDonorRole();
    if (!donorRole)
      throw AppError.internal('DONOR role is missing; run pnpm db:seed');

    const passwordHash = await hashPassword(data.password);
    const created = await authRepository.createDonor({
      email: data.email,
      passwordHash,
      fullName: data.fullName,
      phone: data.phone,
      donorRoleId: donorRole.id,
    }).catch((error: unknown) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw AppError.conflict(ERROR_CODES.AUTH_EMAIL_EXISTS);
      }
      throw error;
    });

    await auditLogService.recordSafely(
      {
        actorId: created.id,
        action: AUDIT_ACTIONS.USER_CREATED,
        entityType: AUDIT_ENTITY_TYPES.USER,
        entityId: created.id,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      },
      database,
    );

    const user = await authRepository.findByIdWithAccess(created.id);
    if (!user) throw AppError.internal('User vanished right after creation');

    const tokens = await issueSession(user, ctx);
    return { tokens, user: toCurrentUser(user) };
  },

  async login(input: unknown, ctx: RequestContext): Promise<AuthResult> {
    const data = validateLogin(input);
    const user = await authRepository.findByEmailWithAccess(data.email);

    const passwordOk =
      user?.passwordHash != null
        ? await verifyPassword(data.password, user.passwordHash)
        : false;

    if (!user || !passwordOk) {
      await auditLogService.recordSafely(
        {
          actorId: user?.id ?? null,
          action: AUDIT_ACTIONS.LOGIN_FAILED,
          entityType: AUDIT_ENTITY_TYPES.USER,
          entityId: user?.id ?? null,
          metadata: { email: data.email },
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        database,
      );
      throw AppError.unauthorized(ERROR_CODES.AUTH_INVALID_CREDENTIALS);
    }

    if (!user.isActive) {
      throw AppError.unauthorized(ERROR_CODES.AUTH_ACCOUNT_INACTIVE);
    }

    await authRepository.touchLastLogin(user.id);
    await auditLogService.recordSafely(
      {
        actorId: user.id,
        action: AUDIT_ACTIONS.LOGIN_SUCCESS,
        entityType: AUDIT_ENTITY_TYPES.USER,
        entityId: user.id,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      },
      database,
    );

    const tokens = await issueSession(user, ctx);
    return { tokens, user: toCurrentUser(user) };
  },

  async refresh(
    rawToken: string | undefined,
    ctx: RequestContext,
  ): Promise<SessionTokens> {
    if (!rawToken)
      throw AppError.unauthorized(ERROR_CODES.AUTH_SESSION_INVALID);

    let claims: { sub: string; sid: string };
    try {
      claims = verifyRefreshToken(rawToken);
    } catch {
      throw AppError.unauthorized(ERROR_CODES.AUTH_SESSION_INVALID);
    }

    const session = await authRepository.findSessionById(claims.sid);
    if (!session || session.tokenHash !== hashOpaqueToken(rawToken)) {
      throw AppError.unauthorized(ERROR_CODES.AUTH_SESSION_INVALID);
    }
    if (session.revokedAt) {
      // The rotated-out token is being replayed — treat the whole chain as
      // compromised and force every session for this user to re-login.
      await authRepository.revokeAllSessionsForUser(session.userId);
      throw AppError.unauthorized(ERROR_CODES.AUTH_SESSION_INVALID);
    }
    if (session.expiresAt.getTime() < Date.now()) {
      throw AppError.unauthorized(ERROR_CODES.AUTH_SESSION_INVALID);
    }

    const user = await authRepository.findByIdWithAccess(session.userId);
    if (!user || !user.isActive) {
      await authRepository.revokeSession(session.id);
      throw AppError.unauthorized(ERROR_CODES.AUTH_SESSION_INVALID);
    }

    const nextSessionId = randomUUID();
    const nextRefreshToken = signRefreshToken({
      sub: user.id,
      sid: nextSessionId,
    });
    const nextExpiresAt = new Date(
      Date.now() + authConfig.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
    );
    const rotated = await authRepository.rotateSession(session.id, {
      id: nextSessionId,
      userId: user.id,
      tokenHash: hashOpaqueToken(nextRefreshToken),
      expiresAt: nextExpiresAt,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    if (!rotated) {
      // The claim failed because a concurrent request consumed this token
      // first (single-use held) or the token expired in between. The token is
      // dead either way; replaying it LATER is still detected by the revoked
      // branch above, so the whole chain must NOT be revoked here — a honest
      // concurrent retry (double tab/double submit) must not log the winner
      // out. Genuine replay detection stays in the `session.revokedAt` check.
      throw AppError.unauthorized(ERROR_CODES.AUTH_SESSION_INVALID);
    }

    const accessToken = signAccessToken({
      sub: user.id,
      roles: user.roleCodes,
      permissions: user.permissionCodes,
    });
    return {
      accessToken,
      refreshToken: nextRefreshToken,
      refreshExpiresAt: nextExpiresAt,
    };
  },

  /** Idempotent: an already-invalid or missing token is not an error. */
  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) return;
    let sessionId: string;
    try {
      sessionId = verifyRefreshToken(rawToken).sid;
    } catch {
      return;
    }
    await authRepository.revokeSession(sessionId);
  },

  /**
   * Always resolves the same way regardless of whether the email exists, to
   * avoid leaking which addresses are registered. The raw token is returned
   * only in development without SMTP. SMTP failures are logged without
   * credentials/tokens and retain the generic response to avoid enumeration.
   */
  async forgotPassword(
    input: unknown,
  ): Promise<{ devResetToken: string | null }> {
    const data = validateForgotPassword(input);
    const user = await authRepository.findByEmailWithAccess(data.email);
    if (!user) return { devResetToken: null };

    const rawToken = generateOpaqueToken();
    const resetToken = await authRepository.createResetToken({
      userId: user.id,
      tokenHash: hashOpaqueToken(rawToken),
      expiresAt: new Date(
        Date.now() + authConfig.resetTokenTtlMinutes * 60 * 1000,
      ),
    });

    try {
      await passwordResetMailer.send(user.email, rawToken);
    } catch {
      await authRepository.invalidateResetToken(resetToken.id);
      console.error('Password reset email delivery failed', { userId: user.id });
      return { devResetToken: null };
    }
    return { devResetToken: passwordResetMailer.exposesDevelopmentToken ? rawToken : null };
  },

  async resetPassword(input: unknown): Promise<void> {
    const data = validateResetPassword(input);
    const tokenHash = hashOpaqueToken(data.token);
    const resetToken = await authRepository.findResetTokenByHash(tokenHash);

    if (
      !resetToken ||
      resetToken.usedAt ||
      resetToken.expiresAt.getTime() < Date.now()
    ) {
      throw AppError.badRequest(ERROR_CODES.AUTH_RESET_TOKEN_INVALID);
    }

    const passwordHash = await hashPassword(data.newPassword);
    const consumed = await authRepository.consumeResetToken(resetToken.id, resetToken.userId, passwordHash);
    if (!consumed) throw AppError.badRequest(ERROR_CODES.AUTH_RESET_TOKEN_INVALID);

    await auditLogService.recordSafely(
      {
        actorId: resetToken.userId,
        action: AUDIT_ACTIONS.PASSWORD_CHANGED,
        entityType: AUDIT_ENTITY_TYPES.USER,
        entityId: resetToken.userId,
      },
      database,
    );
  },

  async getMe(userId: string): Promise<CurrentUser> {
    const user = await authRepository.findByIdWithAccess(userId);
    if (!user?.isActive) throw AppError.unauthorized(ERROR_CODES.UNAUTHENTICATED);
    return toCurrentUser(user);
  },

  async updateMe(userId: string, input: unknown): Promise<CurrentUser> {
    const data = validateUpdateMe(input);
    const user = await authRepository.findByIdWithAccess(userId);
    if (!user?.isActive) throw AppError.unauthorized(ERROR_CODES.UNAUTHENTICATED);

    const wantsContactUpdate =
      data.phone !== undefined || data.address !== undefined;
    if (wantsContactUpdate && !user.roleCodes.includes('DONOR')) {
      throw AppError.validation({
        phone: 'Chỉ tài khoản người hiến máu có hồ sơ liên hệ (phone/address)',
      });
    }

    const updated = await authRepository.updateProfile(userId, data);
    return toCurrentUser(updated);
  },
};

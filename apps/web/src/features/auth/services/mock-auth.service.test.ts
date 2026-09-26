import { beforeEach, describe, expect, it } from 'vitest';
import { ACTOR_CODES, ROLE_PERMISSIONS } from '@blood/shared-types';
import type { ActorCode } from '@blood/shared-types';
import { AUTH_ERROR_CODES } from '../auth-errors';
import {
  DEMO_ACCOUNTS,
  DEMO_PASSWORD,
  createMockAuthService,
} from './mock-auth.service';

const accountFor = (role: ActorCode) => {
  const account = DEMO_ACCOUNTS.find((item) => item.role === role);
  if (!account) throw new Error(`Thiếu tài khoản demo cho role ${role}`);
  return account;
};

const donorEmail = accountFor('DONOR').email;

describe('MockAuthService', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('signs in one demo account per role', async () => {
    const service = createMockAuthService();

    for (const role of ACTOR_CODES) {
      const account = accountFor(role);
      const user = await service.login({
        email: account.email,
        password: DEMO_PASSWORD,
      });

      expect(user.roles).toEqual([role]);
      expect(user.email).toBe(account.email);
      await service.logout();
    }
  });

  it('grants each role exactly the permissions from the shared matrix', async () => {
    const service = createMockAuthService();

    for (const role of ACTOR_CODES) {
      const user = await service.login({
        email: accountFor(role).email,
        password: DEMO_PASSWORD,
      });

      expect(user.permissions).toEqual([...ROLE_PERMISSIONS[role]]);
      await service.logout();
    }
  });

  it('normalises the email before matching', async () => {
    const service = createMockAuthService();
    const user = await service.login({
      email: `  ${donorEmail.toUpperCase()}  `,
      password: DEMO_PASSWORD,
    });
    expect(user.email).toBe(donorEmail);
  });

  it('rejects a wrong password with INVALID_CREDENTIALS', async () => {
    const service = createMockAuthService();
    await expect(
      service.login({ email: donorEmail, password: 'wrong-password' }),
    ).rejects.toMatchObject({ code: AUTH_ERROR_CODES.INVALID_CREDENTIALS });
  });

  it('rejects an unknown email with INVALID_CREDENTIALS', async () => {
    const service = createMockAuthService();
    await expect(
      service.login({
        email: 'khong-ton-tai@example.local',
        password: DEMO_PASSWORD,
      }),
    ).rejects.toMatchObject({ code: AUTH_ERROR_CODES.INVALID_CREDENTIALS });
  });

  it('rejects a deactivated account with ACCOUNT_INACTIVE', async () => {
    const inactive = DEMO_ACCOUNTS.find((account) => !account.isActive);
    expect(inactive).toBeDefined();
    const service = createMockAuthService();

    await expect(
      service.login({ email: inactive?.email ?? '', password: DEMO_PASSWORD }),
    ).rejects.toMatchObject({ code: AUTH_ERROR_CODES.ACCOUNT_INACTIVE });
  });

  it('has no session before login and none after logout', async () => {
    const service = createMockAuthService();
    expect(await service.getCurrentUser()).toBeNull();

    await service.login({ email: donorEmail, password: DEMO_PASSWORD });
    expect(await service.getCurrentUser()).not.toBeNull();

    await service.logout();
    expect(await service.getCurrentUser()).toBeNull();
  });

  describe('register', () => {
    it('always creates a DONOR — the client cannot choose a role', async () => {
      const service = createMockAuthService();
      await service.register({
        fullName: 'Người Hiến Mới',
        email: 'new-donor@example.local',
        password: DEMO_PASSWORD,
      });

      const user = await service.login({
        email: 'new-donor@example.local',
        password: DEMO_PASSWORD,
      });
      expect(user.roles).toEqual(['DONOR']);
      expect(user.permissions).toEqual([...ROLE_PERMISSIONS.DONOR]);
    });

    it('rejects an email that already exists', async () => {
      const service = createMockAuthService();
      await expect(
        service.register({
          fullName: 'Trùng Email',
          email: donorEmail,
          password: DEMO_PASSWORD,
        }),
      ).rejects.toMatchObject({ code: AUTH_ERROR_CODES.EMAIL_ALREADY_EXISTS });
    });

    it('signs the new user in, matching the API registration response', async () => {
      const service = createMockAuthService();
      await service.register({
        fullName: 'Người Hiến Mới',
        email: 'new-donor@example.local',
        password: DEMO_PASSWORD,
      });
      await expect(service.getCurrentUser()).resolves.toMatchObject({
        email: 'new-donor@example.local',
        roles: ['DONOR'],
      });
    });
  });

  describe('forgot password', () => {
    it('resolves even for an unknown email (no account enumeration)', async () => {
      const service = createMockAuthService();
      await expect(
        service.forgotPassword({ email: 'khong-ton-tai@example.local' }),
      ).resolves.toEqual({
        message: 'Nếu email tồn tại, hướng dẫn đặt lại mật khẩu đã được gửi',
      });
    });
  });

  describe('reset password', () => {
    it('resolves for a valid token', async () => {
      const service = createMockAuthService();
      await expect(
        service.resetPassword({
          token: 'mock-reset-token',
          password: DEMO_PASSWORD,
        }),
      ).resolves.toBeUndefined();
    });

    it('rejects an expired token', async () => {
      const service = createMockAuthService();
      await expect(
        service.resetPassword({
          token: 'mock-reset-expired',
          password: DEMO_PASSWORD,
        }),
      ).rejects.toMatchObject({ code: AUTH_ERROR_CODES.RESET_TOKEN_EXPIRED });
    });

    it('rejects an unknown token', async () => {
      const service = createMockAuthService();
      await expect(
        service.resetPassword({
          token: 'khong-hop-le',
          password: DEMO_PASSWORD,
        }),
      ).rejects.toMatchObject({ code: AUTH_ERROR_CODES.RESET_TOKEN_INVALID });
    });
  });

  describe('updateProfile', () => {
    it('updates the full name and reflects it in the session', async () => {
      const service = createMockAuthService();
      await service.login({ email: donorEmail, password: DEMO_PASSWORD });

      const updated = await service.updateProfile({ fullName: 'Tên Đã Đổi' });
      expect(updated.fullName).toBe('Tên Đã Đổi');
      expect((await service.getCurrentUser())?.fullName).toBe('Tên Đã Đổi');
    });

    it('refuses when there is no session', async () => {
      const service = createMockAuthService();
      await expect(
        service.updateProfile({ fullName: 'Không Phiên' }),
      ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    });
  });
});

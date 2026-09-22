import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAccessToken, setAccessToken } from '@/services/api';
import { ApiAuthService } from './api-auth.service';
// Read-only contract checks against the delivered backend validation.
import {
  validateRegister,
  validateResetPassword,
  validateUpdateMe,
} from '../../../../../api/src/modules/auth/auth.validation';

const user = {
  id: 'user-1',
  email: 'donor.demo@example.local',
  fullName: 'Donor Demo',
  roles: ['DONOR'],
  permissions: ['auth.profile.read', 'auth.profile.update'],
};

const ok = (data: unknown) =>
  new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

afterEach(() => {
  setAccessToken(null);
  vi.unstubAllGlobals();
});

describe('ApiAuthService', () => {
  it('logs in through the backend contract and keeps the access token in memory', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(ok({ accessToken: 'access-token', user }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await new ApiAuthService().login({
      email: user.email,
      password: 'Demo@Password1',
    });

    expect(result).toEqual(user);
    expect(getAccessToken()).toBe('access-token');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/login',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ email: user.email, password: 'Demo@Password1' }),
      }),
    );
  });

  it('registers a donor, stores the returned token and accepts no role input', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(ok({ accessToken: 'registered-token', user }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      new ApiAuthService().register({
        fullName: user.fullName,
        email: user.email,
        password: 'Demo@Password1',
      }),
    ).resolves.toEqual(user);
    expect(getAccessToken()).toBe('registered-token');
    expect(
      validateRegister(JSON.parse(fetchMock.mock.calls[0]?.[1].body)),
    ).toEqual({
      fullName: user.fullName,
      email: user.email,
      password: 'Demo@Password1',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/register',
      expect.objectContaining({
        body: JSON.stringify({
          fullName: user.fullName,
          email: user.email,
          password: 'Demo@Password1',
        }),
      }),
    );
  });

  it('restores an expired access token through the refresh cookie', async () => {
    const unauthorized = new Response(
      JSON.stringify({
        success: false,
        error: { code: 'UNAUTHENTICATED', message: 'Expired', fields: null },
      }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    );
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(unauthorized)
      .mockResolvedValueOnce(ok({ accessToken: 'rotated-token' }))
      .mockResolvedValueOnce(ok(user));
    vi.stubGlobal('fetch', fetchMock);

    await expect(new ApiAuthService().getCurrentUser()).resolves.toEqual(user);
    expect(getAccessToken()).toBe('rotated-token');
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/auth/refresh');
    expect(fetchMock.mock.calls[2]?.[1]).toEqual(
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer rotated-token',
        }),
      }),
    );
  });

  it('exposes the development reset token returned by the backend', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        ok({
          message: 'Nếu email tồn tại, hướng dẫn đặt lại mật khẩu đã được gửi',
          devResetToken: 'reset-token',
        }),
      ),
    );

    await expect(
      new ApiAuthService().forgotPassword({ email: user.email }),
    ).resolves.toEqual({
      message: 'Nếu email tồn tại, hướng dẫn đặt lại mật khẩu đã được gửi',
      devResetToken: 'reset-token',
    });
  });

  it('sends a reset request accepted by the original backend validator', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({}));
    vi.stubGlobal('fetch', fetchMock);

    await new ApiAuthService().resetPassword({
      token: 'reset-token',
      password: 'NewPassword1',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/reset-password',
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
    const payload = JSON.parse(fetchMock.mock.calls[0]?.[1].body);
    expect(validateResetPassword(payload)).toEqual({
      token: 'reset-token',
      newPassword: 'NewPassword1',
    });
    expect(payload).not.toHaveProperty('password');
  });

  it('updates a profile using the original CurrentUser response without contact fields', async () => {
    const updatedUser = { ...user, fullName: 'Updated Donor' };
    const fetchMock = vi.fn().mockResolvedValue(ok(updatedUser));
    vi.stubGlobal('fetch', fetchMock);
    setAccessToken('access-token');

    await expect(
      new ApiAuthService().updateProfile({ fullName: 'Updated Donor' }),
    ).resolves.toEqual(updatedUser);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/me',
      expect.objectContaining({
        method: 'PATCH',
        headers: expect.objectContaining({
          Authorization: 'Bearer access-token',
        }),
      }),
    );
    expect(
      validateUpdateMe(JSON.parse(fetchMock.mock.calls[0]?.[1].body)),
    ).toEqual({ fullName: 'Updated Donor' });
  });

  it('sends DONOR contact updates accepted by the original backend validator', async () => {
    const updatedUser = {
      ...user,
      fullName: 'Updated Donor',
      phone: '0901234567',
      address: '123 Đường ABC, Quận 1',
    };
    const fetchMock = vi.fn().mockResolvedValue(ok(updatedUser));
    vi.stubGlobal('fetch', fetchMock);
    setAccessToken('access-token');

    const input = {
      fullName: 'Updated Donor',
      phone: '0901234567',
      address: '123 Đường ABC, Quận 1',
    };
    await expect(new ApiAuthService().updateProfile(input)).resolves.toEqual(
      updatedUser,
    );
    const payload = JSON.parse(fetchMock.mock.calls[0]?.[1].body);
    // The delivered backend validator must accept the FE payload as-is.
    expect(validateUpdateMe(payload)).toEqual(input);
  });
});

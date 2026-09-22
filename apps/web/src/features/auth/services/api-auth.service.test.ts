import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAccessToken, setAccessToken } from '@/services/api';
import { ApiAuthService } from './api-auth.service';

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
    const fetchMock = vi.fn().mockResolvedValue(
      ok({ accessToken: 'access-token', user }),
    );
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
        headers: expect.objectContaining({ Authorization: 'Bearer rotated-token' }),
      }),
    );
  });

  it('exposes the development reset token returned by the backend', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok({ devResetToken: 'reset-token' })));

    await expect(
      new ApiAuthService().forgotPassword({ email: user.email }),
    ).resolves.toEqual({ devResetToken: 'reset-token' });
  });
});

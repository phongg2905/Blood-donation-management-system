import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ApiRequestError,
  apiGet,
  getAccessToken,
  refreshSession,
  resetRefreshQueue,
  setAccessToken,
  setRefreshHandler,
} from './api';

// The real backend revokes the whole session chain when a rotated-out refresh
// cookie is replayed, so every test here guards the invariant: overlapping
// 401s must share ONE refresh request — the single-use cookie is consumed at
// most once.

const ok = (data: unknown) =>
  new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

const unauthorized = () =>
  new Response(
    JSON.stringify({
      success: false,
      error: { code: 'UNAUTHENTICATED', message: 'Expired', fields: null },
    }),
    { status: 401, headers: { 'Content-Type': 'application/json' } },
  );

afterEach(() => {
  setAccessToken(null);
  setRefreshHandler(null);
  resetRefreshQueue();
  vi.unstubAllGlobals();
});

describe('401 auto-retry through the refresh cookie', () => {
  it('retries once after a successful refresh and keeps the new token', async () => {
    const user = { id: 'u1', email: 'a@b.c' };
    // The refresh handler owns the token store without going through fetch
    // (mirrors ApiAuthService.refresh), so fetch sees attempt 1 fail and the
    // retried attempt succeed.
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(unauthorized()) // GET /auth/me with a dead token
      .mockResolvedValueOnce(ok(user)); // retried GET /auth/me
    vi.stubGlobal('fetch', fetchMock);
    setRefreshHandler(() => {
      setAccessToken('fresh-token'); // mirrors ApiAuthService.refresh
      return Promise.resolve(true);
    });

    await expect(apiGet<typeof user>('/auth/me')).resolves.toEqual(
      expect.objectContaining({ data: user }),
    );
    expect(getAccessToken()).toBe('fresh-token');
    expect(fetchMock.mock.calls.map(([path]) => path)).toEqual([
      '/api/auth/me',
      '/api/auth/me',
    ]);
    // The retry must carry the token minted by the refresh.
    const retryInit = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(retryInit.headers).toEqual(
      expect.objectContaining({ Authorization: 'Bearer fresh-token' }),
    );
  });

  it('does not retry when the refresh fails (no infinite loop on a dead cookie)', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(unauthorized()); // every request fails with 401
    vi.stubGlobal('fetch', fetchMock);
    setRefreshHandler(() => Promise.resolve(false));

    await expect(apiGet('/auth/me')).rejects.toMatchObject({ status: 401 });
    // The failed refresh aborts the flow before any retry request is sent.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('never retries anonymous requests such as /auth/refresh itself', async () => {
    const fetchMock = vi.fn().mockResolvedValue(unauthorized());
    vi.stubGlobal('fetch', fetchMock);
    setRefreshHandler(() => {
      throw new Error('refresh handler must not be invoked');
    });

    await expect(apiGet('/auth/me', { anonymous: true })).rejects.toBeInstanceOf(
      ApiRequestError,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('leaves non-401 failures untouched', async () => {
    const serverError = () =>
      new Response(
        JSON.stringify({
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Boom', fields: null },
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    const fetchMock = vi.fn().mockResolvedValue(serverError());
    vi.stubGlobal('fetch', fetchMock);
    setRefreshHandler(() => {
      throw new Error('refresh handler must not be invoked');
    });

    await expect(apiGet('/campaigns')).rejects.toMatchObject({ status: 500 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('single-flight refreshSession', () => {
  it('shares one refresh among concurrent callers and fans out the result', async () => {
    let calls = 0;
    const refresh = vi.fn(async () => {
      calls += 1;
      await Promise.resolve();
      return true;
    });

    const [first, second, third] = await Promise.all([
      refreshSession(refresh),
      refreshSession(refresh),
      refreshSession(refresh),
    ]);

    expect(calls).toBe(1);
    expect(first).toBe(true);
    expect(second).toBe(true);
    expect(third).toBe(true);

    // The queue drains after completion — a later 401 must refresh again.
    await expect(refreshSession(refresh)).resolves.toBe(true);
    expect(calls).toBe(2);
  });

  it('fans out a failed refresh and still drains the queue', async () => {
    let calls = 0;
    const refresh = vi.fn(async () => {
      calls += 1;
      await Promise.resolve();
      return false; // cookie gone — an anonymous state, not an error
    });

    const [first, second] = await Promise.all([
      refreshSession(refresh),
      refreshSession(refresh),
    ]);

    expect(calls).toBe(1);
    expect(first).toBe(false);
    expect(second).toBe(false);
    await expect(refreshSession(refresh)).resolves.toBe(false);
    expect(calls).toBe(2);
  });
});

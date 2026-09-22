// The suite registers many donors from 127.0.0.1, which the per-IP auth rate
// limiter would throttle (the .env sets NODE_ENV=development even for tests).
// Flag the process as test env before any request so the limiter skips.
process.env.NODE_ENV = 'test';

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { after, before, describe, test } from 'node:test';
import { app } from '../../app';
import { hashPassword } from '../../common/security/password';
import { database } from '../../config/database';

const server = app.listen(0, '127.0.0.1');
let base: string;

before(async () => {
  await new Promise<void>((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  await database.$disconnect();
});

const STRONG_PASSWORD = 'Passw0rd!23';

function extractCookie(response: Response, name: string): string | undefined {
  const raw = response.headers
    .getSetCookie()
    .find((c) => c.startsWith(`${name}=`));
  return raw?.split(';', 1)[0];
}

/** Registers a fresh DONOR and returns everything a test needs to act as them. */
async function registerDonor() {
  const email = `${randomUUID()}@example.test`;
  const response = await fetch(`${base}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password: STRONG_PASSWORD,
      fullName: 'Auth Test Donor',
    }),
  });
  const body = await response.json();
  const refreshCookie = extractCookie(response, 'bd_refresh_token');
  return { email, response, body, refreshCookie };
}

/** Deletes everything the DonorProfile RESTRICT constraint requires first. */
async function cleanupUser(userId: string): Promise<void> {
  await database.donorProfile.deleteMany({ where: { userId } });
  await database.user.delete({ where: { id: userId } }).catch(() => undefined);
}

describe('POST /auth/register', () => {
  test('creates a DONOR, returns tokens and sets the refresh cookie', async () => {
    const { response, body, refreshCookie } = await registerDonor();
    try {
      assert.equal(response.status, 201);
      assert.equal(body.success, true);
      assert.equal(typeof body.data.accessToken, 'string');
      assert.deepEqual(body.data.user.roles, ['DONOR']);
      assert.ok(body.data.user.permissions.includes('auth.profile.read'));
      assert.ok(refreshCookie?.startsWith('bd_refresh_token='));
    } finally {
      await cleanupUser(body.data.user.id);
    }
  });

  test('rejects a duplicate email with AUTH_EMAIL_EXISTS', async () => {
    const first = await registerDonor();
    try {
      const second = await fetch(`${base}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: first.email,
          password: STRONG_PASSWORD,
          fullName: 'Duplicate',
        }),
      });
      const secondBody = await second.json();
      assert.equal(second.status, 409);
      assert.equal(secondBody.error.code, 'AUTH_EMAIL_EXISTS');
    } finally {
      await cleanupUser(first.body.data.user.id);
    }
  });

  test('rejects a weak password before touching the database', async () => {
    const response = await fetch(`${base}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `${randomUUID()}@example.test`,
        password: 'weak',
        fullName: 'Weak Password',
      }),
    });
    const body = await response.json();
    assert.equal(response.status, 400);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
    assert.ok('password' in body.error.fields);
  });
});

describe('POST /auth/login', () => {
  test('rejects a wrong password with AUTH_INVALID_CREDENTIALS', async () => {
    const donor = await registerDonor();
    try {
      const response = await fetch(`${base}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: donor.email,
          password: 'WrongPassw0rd!',
        }),
      });
      const body = await response.json();
      assert.equal(response.status, 401);
      assert.equal(body.error.code, 'AUTH_INVALID_CREDENTIALS');
    } finally {
      await cleanupUser(donor.body.data.user.id);
    }
  });

  test('an unknown email fails the same way as a wrong password', async () => {
    const response = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `${randomUUID()}@example.test`,
        password: STRONG_PASSWORD,
      }),
    });
    const body = await response.json();
    assert.equal(response.status, 401);
    assert.equal(body.error.code, 'AUTH_INVALID_CREDENTIALS');
  });

  test('a correct login round-trips through GET /auth/me', async () => {
    const donor = await registerDonor();
    try {
      const login = await fetch(`${base}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: donor.email, password: STRONG_PASSWORD }),
      });
      const loginBody = await login.json();
      assert.equal(login.status, 200);

      const me = await fetch(`${base}/api/auth/me`, {
        headers: { Authorization: `Bearer ${loginBody.data.accessToken}` },
      });
      const meBody = await me.json();
      assert.equal(me.status, 200);
      assert.equal(meBody.data.email, donor.email);
      assert.deepEqual(meBody.data.roles, ['DONOR']);
    } finally {
      await cleanupUser(donor.body.data.user.id);
    }
  });
});

describe('GET /auth/me without a token', () => {
  test('returns UNAUTHENTICATED', async () => {
    const response = await fetch(`${base}/api/auth/me`);
    const body = await response.json();
    assert.equal(response.status, 401);
    assert.equal(body.error.code, 'UNAUTHENTICATED');
  });
});

describe('POST /auth/refresh', () => {
  test('rotates the session and rejects the replayed old cookie', async () => {
    const donor = await registerDonor();
    try {
      const firstRefresh = await fetch(`${base}/api/auth/refresh`, {
        method: 'POST',
        headers: { Cookie: donor.refreshCookie! },
      });
      const firstBody = await firstRefresh.json();
      const rotatedCookie = extractCookie(firstRefresh, 'bd_refresh_token');
      assert.equal(firstRefresh.status, 200);
      assert.equal(typeof firstBody.data.accessToken, 'string');
      assert.ok(rotatedCookie && rotatedCookie !== donor.refreshCookie);

      // Reusing the original (now-rotated-out) cookie must fail — replay defence.
      const replay = await fetch(`${base}/api/auth/refresh`, {
        method: 'POST',
        headers: { Cookie: donor.refreshCookie! },
      });
      const replayBody = await replay.json();
      assert.equal(replay.status, 401);
      assert.equal(replayBody.error.code, 'AUTH_SESSION_INVALID');

      // Replay detection revokes the whole chain, so even the freshly
      // rotated cookie is now dead.
      const afterReplay = await fetch(`${base}/api/auth/refresh`, {
        method: 'POST',
        headers: { Cookie: rotatedCookie! },
      });
      assert.equal(afterReplay.status, 401);
    } finally {
      await cleanupUser(donor.body.data.user.id);
    }
  });

  test('rejects a missing or garbled cookie', async () => {
    const response = await fetch(`${base}/api/auth/refresh`, {
      method: 'POST',
    });
    const body = await response.json();
    assert.equal(response.status, 401);
    assert.equal(body.error.code, 'AUTH_SESSION_INVALID');
  });
});

describe('POST /auth/logout', () => {
  test('revokes the session so a subsequent refresh fails', async () => {
    const donor = await registerDonor();
    try {
      const logout = await fetch(`${base}/api/auth/logout`, {
        method: 'POST',
        headers: { Cookie: donor.refreshCookie! },
      });
      assert.equal(logout.status, 200);
      assert.ok(
        logout.headers
          .getSetCookie()
          .some((c) => c.startsWith('bd_refresh_token=;')),
      );

      const refresh = await fetch(`${base}/api/auth/refresh`, {
        method: 'POST',
        headers: { Cookie: donor.refreshCookie! },
      });
      assert.equal(refresh.status, 401);
    } finally {
      await cleanupUser(donor.body.data.user.id);
    }
  });

  test('is idempotent for a missing cookie', async () => {
    const response = await fetch(`${base}/api/auth/logout`, { method: 'POST' });
    assert.equal(response.status, 200);
  });
});

describe('Forgot / reset password', () => {
  test('resets the password and revokes every existing session', async () => {
    const donor = await registerDonor();
    try {
      const forgot = await fetch(`${base}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: donor.email }),
      });
      const forgotBody = await forgot.json();
      assert.equal(forgot.status, 200);
      // Outside production the dev token comes back so the flow is testable
      // without an email service (see auth.service.ts forgotPassword).
      assert.equal(typeof forgotBody.data.devResetToken, 'string');

      const newPassword = 'NewPassw0rd!45';
      const reset = await fetch(`${base}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: forgotBody.data.devResetToken,
          newPassword,
        }),
      });
      assert.equal(reset.status, 200);

      // Old refresh token is dead — password reset revokes every session.
      const refresh = await fetch(`${base}/api/auth/refresh`, {
        method: 'POST',
        headers: { Cookie: donor.refreshCookie! },
      });
      assert.equal(refresh.status, 401);

      // Old password no longer works; the new one does.
      const oldLogin = await fetch(`${base}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: donor.email, password: STRONG_PASSWORD }),
      });
      assert.equal(oldLogin.status, 401);

      const newLogin = await fetch(`${base}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: donor.email, password: newPassword }),
      });
      assert.equal(newLogin.status, 200);
    } finally {
      await cleanupUser(donor.body.data.user.id);
    }
  });

  test('does not reveal whether an email exists', async () => {
    const response = await fetch(`${base}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `${randomUUID()}@example.test` }),
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.data.devResetToken, undefined);
  });

  test('rejects an already-used or unknown token', async () => {
    const response = await fetch(`${base}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: 'not-a-real-token',
        newPassword: STRONG_PASSWORD,
      }),
    });
    const body = await response.json();
    assert.equal(response.status, 400);
    assert.equal(body.error.code, 'AUTH_RESET_TOKEN_INVALID');
  });
});

describe('Token single-use under concurrent requests', () => {
  // Regression for the two races reported during FE integration: one reset
  // token and one refresh token must each be consumable exactly once, even
  // when two requests arrive together. The repository relies on a per-user
  // row lock (SELECT ... FOR UPDATE) plus conditional updateMany claims.

  test('concurrent reset-password calls with one token succeed at most once', async () => {
    const donor = await registerDonor();
    try {
      const forgot = await fetch(`${base}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: donor.email }),
      });
      const forgotBody = await forgot.json();
      const token = forgotBody.data.devResetToken;
      assert.equal(typeof token, 'string');

      // Two reset attempts with the SAME token and DIFFERENT new passwords.
      const [first, second] = await Promise.all([
        fetch(`${base}/api/auth/reset-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, newPassword: 'FirstPassw0rd!1' }),
        }),
        fetch(`${base}/api/auth/reset-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, newPassword: 'SecondPassw0rd!2' }),
        }),
      ]);

      const statuses = [first.status, second.status].sort();
      assert.deepEqual(statuses, [200, 400]);

      // Exactly one of the two candidate passwords must work — the winner of
      // the race. Both succeeding would mean double consumption.
      const loginFirst = await fetch(`${base}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: donor.email,
          password: 'FirstPassw0rd!1',
        }),
      });
      const loginSecond = await fetch(`${base}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: donor.email,
          password: 'SecondPassw0rd!2',
        }),
      });
      assert.equal(
        [loginFirst.status, loginSecond.status].filter((s) => s === 200).length,
        1,
      );
    } finally {
      await cleanupUser(donor.body.data.user.id);
    }
  });

  test('concurrent refresh calls with one cookie issue one session at most', async () => {
    const donor = await registerDonor();
    try {
      const [first, second] = await Promise.all([
        fetch(`${base}/api/auth/refresh`, {
          method: 'POST',
          headers: { Cookie: donor.refreshCookie! },
        }),
        fetch(`${base}/api/auth/refresh`, {
          method: 'POST',
          headers: { Cookie: donor.refreshCookie! },
        }),
      ]);

      const statuses = [first.status, second.status].sort();
      assert.deepEqual(statuses, [200, 401]);

      // Only one fresh cookie may have been minted by the race.
      const firstCookie = extractCookie(first, 'bd_refresh_token');
      const secondCookie = extractCookie(second, 'bd_refresh_token');
      const rotated = firstCookie ?? secondCookie;
      assert.ok(rotated, 'the winning refresh must set a new cookie');

      // The winning session still works afterwards.
      const followUp = await fetch(`${base}/api/auth/refresh`, {
        method: 'POST',
        headers: { Cookie: rotated },
      });
      assert.equal(followUp.status, 200);
    } finally {
      await cleanupUser(donor.body.data.user.id);
    }
  });
});

describe('PATCH /auth/me', () => {
  test('updates fullName and, for a DONOR, phone/address', async () => {
    const donor = await registerDonor();
    try {
      const response = await fetch(`${base}/api/auth/me`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${donor.body.data.accessToken}`,
        },
        body: JSON.stringify({
          fullName: 'Renamed Donor',
          phone: '0901234567',
        }),
      });
      const body = await response.json();
      assert.equal(response.status, 200);
      assert.equal(body.data.fullName, 'Renamed Donor');
    } finally {
      await cleanupUser(donor.body.data.user.id);
    }
  });

  test('rejects phone/address for a non-DONOR account', async () => {
    // No public endpoint provisions STAFF/ADMIN yet (Phase 8), so the fixture
    // is created directly against the database, mirroring seedAdmin().
    const role = await database.role.findUniqueOrThrow({
      where: { code: 'RECEPTION_STAFF' },
    });
    const email = `${randomUUID()}@example.test`;
    const user = await database.user.create({
      data: {
        email,
        fullName: 'Reception Staff Fixture',
        passwordHash: await hashPassword(STRONG_PASSWORD),
        isActive: true,
        roles: { create: { roleId: role.id } },
      },
    });
    try {
      const login = await fetch(`${base}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: STRONG_PASSWORD }),
      });
      const loginBody = await login.json();

      const response = await fetch(`${base}/api/auth/me`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${loginBody.data.accessToken}`,
        },
        body: JSON.stringify({ phone: '0901234567' }),
      });
      const body = await response.json();
      assert.equal(response.status, 400);
      assert.equal(body.error.code, 'VALIDATION_ERROR');
    } finally {
      await database.user.delete({ where: { id: user.id } });
    }
  });
});

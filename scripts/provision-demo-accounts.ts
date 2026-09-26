/** Local-only helper; does not modify BE code, seed or the permission matrix. */
import { database } from '../apps/api/src/config/database';
import { env } from '../apps/api/src/config/env';
import {
  hashPassword,
  verifyPassword,
} from '../apps/api/src/common/security/password';
import {
  DEMO_LOGIN_ACCOUNTS,
  DEMO_LOGIN_PASSWORD,
} from '../apps/web/src/features/auth/demo/demo-accounts';
// Read straight from the shared matrix so the check follows the four-actor
// model instead of hard-coding one permission. Imported from source because
// this root-level script runs outside any workspace package's node_modules.
import { ROLE_PERMISSIONS } from '../packages/shared-types/src/index';

/**
 * Removes the four demo users so they can be recreated from the current
 * catalogue. Refuses to touch an account that has real business data
 * (registrations, campaign assignments, notifications or performed
 * check-ins/screenings/donations) so other members' local work is never
 * destroyed. Auth sessions/roles cascade; audit logs keep a null actor.
 */
async function resetDemoAccounts(): Promise<void> {
  const emails = DEMO_LOGIN_ACCOUNTS.map((account) => account.email);
  const users = await database.user.findMany({
    where: { email: { in: emails } },
    select: { id: true, email: true },
  });
  if (users.length === 0) {
    console.info('No demo accounts to remove.');
    return;
  }
  const ids = users.map((user) => user.id);
  const [
    profileIds,
    assignments,
    notifications,
    checkIns,
    screenings,
    donations,
  ] = await Promise.all([
    database.donorProfile
      .findMany({ where: { userId: { in: ids } }, select: { id: true } })
      .then((rows) => rows.map((row) => row.id)),
    database.campaignStaff.count({ where: { userId: { in: ids } } }),
    database.notification.count({ where: { userId: { in: ids } } }),
    database.checkIn.count({ where: { checkedInById: { in: ids } } }),
    database.screening.count({ where: { screenedById: { in: ids } } }),
    database.donation.count({ where: { performedById: { in: ids } } }),
  ]);
  const registrations = profileIds.length
    ? await database.registration.count({
        where: { donorId: { in: profileIds } },
      })
    : 0;
  const blockers = {
    registrations,
    assignments,
    notifications,
    checkIns,
    screenings,
    donations,
  };
  const blocking = Object.entries(blockers).filter(([, count]) => count > 0);
  if (blocking.length > 0) {
    throw new Error(
      `Refusing to delete demo accounts with business data (${blocking
        .map(([name, count]) => `${name}=${count}`)
        .join(', ')}). Resolve those records manually first.`,
    );
  }
  await database.$transaction(async (tx) => {
    // DonorProfile.user is onDelete: Restrict, so it must go first. Roles and
    // auth sessions cascade; audit logs keep a null actor (SetNull).
    await tx.donorProfile.deleteMany({ where: { userId: { in: ids } } });
    await tx.userRole.deleteMany({ where: { userId: { in: ids } } });
    await tx.user.deleteMany({ where: { id: { in: ids } } });
  });
  console.info(
    `Removed ${users.length} demo account(s): ${users.map((user) => user.email).join(', ')}`,
  );
}

async function main() {
  const target = new URL(env.DATABASE_URL);
  if (
    env.NODE_ENV === 'production' ||
    !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)
  ) {
    throw new Error(
      'Demo provisioning only supports a local non-production database.',
    );
  }
  const verifyOnly = process.argv.includes('--verify');
  const reset = process.argv.includes('--reset');
  if (verifyOnly && reset)
    throw new Error('--verify and --reset cannot be combined.');
  if (reset) await resetDemoAccounts();
  if (!verifyOnly) {
    const passwordHash = await hashPassword(DEMO_LOGIN_PASSWORD);
    const results = await database.$transaction(
      async (tx) => {
        const results: string[] = [];
        for (const account of DEMO_LOGIN_ACCOUNTS) {
          const role = await tx.role.findUnique({
            where: { code: account.role },
            include: { _count: { select: { permissions: true } } },
          });
          if (!role || role._count.permissions === 0)
            throw new Error(
              `Missing role/permissions: ${account.role}. Run the project's normal RBAC setup first.`,
            );
          const existing = await tx.user.findUnique({
            where: { email: account.email },
            include: { roles: { include: { role: true } } },
          });
          if (existing) {
            if (
              !existing.isActive ||
              existing.roles.length !== 1 ||
              existing.roles[0]?.role.code !== account.role ||
              !existing.passwordHash ||
              !(await verifyPassword(
                DEMO_LOGIN_PASSWORD,
                existing.passwordHash,
              ))
            ) {
              throw new Error(
                `Existing account ${account.email} differs from the demo fixture; left untouched.`,
              );
            }
            results.push(
              `Ready (existing): ${account.email} — ${account.role}`,
            );
            continue;
          }
          await tx.user.create({
            data: {
              email: account.email,
              fullName: account.fullName,
              passwordHash,
              isActive: true,
              roles: { create: { roleId: role.id } },
            },
          });
          results.push(`Created: ${account.email} — ${account.role}`);
        }
        return results;
      },
      { timeout: 20000 },
    );
    results.forEach((result) => console.info(result));
  }
  if (verifyOnly) {
    const base = `http://127.0.0.1:${env.API_PORT}/api`;
    for (const account of DEMO_LOGIN_ACCOUNTS) {
      const response = await fetch(`${base}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: account.email,
          password: DEMO_LOGIN_PASSWORD,
        }),
      });
      const body = (await response.json()) as {
        success: boolean;
        data?: {
          accessToken: string;
          user: { roles: string[]; permissions: string[] };
        };
      };
      const expected = ROLE_PERMISSIONS[account.role];
      if (!expected)
        throw new Error(`No permission matrix for role ${account.role}`);
      const actualPermissions = new Set(body.data?.user.permissions ?? []);
      const permissionsMatch =
        expected.length === actualPermissions.size &&
        expected.every((permission) => actualPermissions.has(permission));
      if (
        !response.ok ||
        !body.success ||
        !body.data ||
        body.data.user.roles.length !== 1 ||
        body.data.user.roles[0] !== account.role ||
        !permissionsMatch
      )
        throw new Error(
          `Login verification failed for ${account.email}: HTTP ${response.status} (${
            body.data?.user.permissions.length ?? 0
          } permissions, role ${body.data?.user.roles[0] ?? 'none'})`,
        );
      const cookies = response.headers
        .getSetCookie()
        .map((value) => value.split(';')[0])
        .join('; ');
      const logout = await fetch(`${base}/auth/logout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${body.data.accessToken}`,
          Cookie: cookies,
        },
      });
      if (!logout.ok)
        throw new Error(`Demo session cleanup failed: HTTP ${logout.status}`);
      console.info(
        `Verified login/logout: ${account.email} — ${account.role} (${body.data.user.permissions.length} permissions)`,
      );
    }
  }
}
main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Demo setup failed');
    process.exitCode = 1;
  })
  .finally(() => database.$disconnect());

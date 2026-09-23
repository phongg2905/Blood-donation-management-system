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
      if (
        !response.ok ||
        !body.success ||
        !body.data ||
        body.data.user.roles.length !== 1 ||
        body.data.user.roles[0] !== account.role ||
        !body.data.user.permissions.includes('campaign.read')
      )
        throw new Error(
          `Login verification failed for ${account.email}: HTTP ${response.status}`,
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

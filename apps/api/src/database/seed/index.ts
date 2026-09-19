import {
  PERMISSION_CODES,
  ROLE_CODES,
  ROLE_NAMES,
  ROLE_PERMISSIONS,
} from '@blood/shared-types';
import { hashPassword } from '../../common/security/password';
import { database } from '../../config/database';
import { env } from '../../config/env';

/**
 * Idempotent Phase 1 seed: five roles, the permission catalogue, the
 * role-permission matrix and an optional initial admin account.
 *
 * Safe to run repeatedly. No credential is hard-coded: the admin password comes
 * from ADMIN_PASSWORD and is stored only as a scrypt hash.
 */

async function seedRoles(): Promise<void> {
  for (const code of ROLE_CODES) {
    await database.role.upsert({
      where: { code },
      create: { code, name: ROLE_NAMES[code] },
      update: { name: ROLE_NAMES[code] },
    });
  }
}

async function seedPermissions(): Promise<void> {
  for (const code of PERMISSION_CODES) {
    await database.permission.upsert({
      where: { code },
      create: { code, name: code },
      update: { name: code },
    });
  }
}

/** Converges RolePermission on exactly the mapping declared in shared-types. */
async function seedRolePermissions(): Promise<void> {
  const [roles, permissions, existing] = await Promise.all([
    database.role.findMany({
      where: { code: { in: [...ROLE_CODES] } },
      select: { id: true, code: true },
    }),
    database.permission.findMany({
      where: { code: { in: [...PERMISSION_CODES] } },
      select: { id: true, code: true },
    }),
    database.rolePermission.findMany({
      select: { id: true, roleId: true, permissionId: true },
    }),
  ]);

  const roleIdByCode = new Map(roles.map((role) => [role.code, role.id]));
  const permissionIdByCode = new Map(
    permissions.map((permission) => [permission.code, permission.id]),
  );

  const desired = new Set<string>();
  const toCreate: { roleId: string; permissionId: string }[] = [];

  for (const roleCode of ROLE_CODES) {
    const roleId = roleIdByCode.get(roleCode);
    if (!roleId) throw new Error(`Seed failed: role ${roleCode} is missing`);
    for (const permissionCode of ROLE_PERMISSIONS[roleCode]) {
      const permissionId = permissionIdByCode.get(permissionCode);
      if (!permissionId) {
        throw new Error(`Seed failed: permission ${permissionCode} is missing`);
      }
      const key = `${roleId}:${permissionId}`;
      desired.add(key);
    }
  }

  const existingKeys = new Set(
    existing.map((row) => `${row.roleId}:${row.permissionId}`),
  );
  for (const key of desired) {
    if (existingKeys.has(key)) continue;
    const [roleId, permissionId] = key.split(':');
    if (roleId && permissionId) toCreate.push({ roleId, permissionId });
  }
  if (toCreate.length > 0) {
    await database.rolePermission.createMany({
      data: toCreate,
      skipDuplicates: true,
    });
  }

  // Remove mappings that are no longer part of the declared matrix.
  const staleIds = existing
    .filter((row) => !desired.has(`${row.roleId}:${row.permissionId}`))
    .map((row) => row.id);
  if (staleIds.length > 0) {
    await database.rolePermission.deleteMany({
      where: { id: { in: staleIds } },
    });
  }
}

async function seedAdmin(): Promise<void> {
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) {
    console.info(
      'ADMIN_EMAIL/ADMIN_PASSWORD not set; skipped the initial admin account.',
    );
    return;
  }
  const fullName = env.ADMIN_FULL_NAME ?? 'Quản trị viên';
  const passwordHash = await hashPassword(env.ADMIN_PASSWORD);

  const user = await database.user.upsert({
    where: { email: env.ADMIN_EMAIL },
    create: { email: env.ADMIN_EMAIL, fullName, passwordHash, isActive: true },
    update: { fullName, passwordHash },
  });

  const adminRole = await database.role.findUnique({
    where: { code: 'ADMIN' },
  });
  if (!adminRole) throw new Error('Seed failed: ADMIN role is missing');

  await database.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: adminRole.id } },
    create: { userId: user.id, roleId: adminRole.id },
    update: {},
  });
  console.info(`Seeded the initial admin account (${env.ADMIN_EMAIL}).`);
}

async function seed(): Promise<void> {
  await seedRoles();
  await seedPermissions();
  await seedRolePermissions();
  await seedAdmin();
  console.info(
    `Seeded ${ROLE_CODES.length} roles, ${PERMISSION_CODES.length} permissions and the role-permission matrix.`,
  );
}

seed()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await database.$disconnect();
  });

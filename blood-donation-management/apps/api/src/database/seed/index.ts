import { ROLE_CODES } from '@blood/shared-types';
import { database } from '../../config/database';

async function seed() {
  await database.$transaction(
    ROLE_CODES.map((code) =>
      database.role.upsert({
        where: { code },
        create: { code, name: code },
        update: {},
      }),
    ),
  );
  console.info('Seeded seven RBAC roles. No accounts or passwords created.');
}
seed()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await database.$disconnect();
  });

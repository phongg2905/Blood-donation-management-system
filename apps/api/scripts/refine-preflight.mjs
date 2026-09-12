import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
config({
  path: fileURLToPath(new URL('../../../.env', import.meta.url)),
  quiet: true,
});
const db = new PrismaClient();
async function main() {
  const duplicates =
    await db.$queryRaw`SELECT count(*)::int AS count FROM (SELECT "screeningId", code FROM "ScreeningTest" GROUP BY "screeningId", code HAVING count(*) > 1) duplicates`;
  if (duplicates[0].count !== 0)
    throw new Error(
      'Duplicate screening test codes exist; resolve manually before migration. No records changed.',
    );
  const counts = {};
  const models = [
    'user',
    'role',
    'permission',
    'userRole',
    'rolePermission',
    'donorProfile',
    'donationCampaign',
    'campaignTimeSlot',
    'campaignStaff',
    'registration',
    'healthDeclaration',
    'checkIn',
    'screening',
    'screeningTest',
    'donation',
    'bloodBag',
    'postDonationReaction',
    'certificate',
    'notification',
    'auditLog',
    'systemSetting',
  ];
  for (const model of models) counts[model] = await db[model].count();
  console.log(JSON.stringify({ duplicateScreeningTests: 0, counts }, null, 2));
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

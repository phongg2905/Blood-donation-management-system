import { database } from '../config/database';

/**
 * One-shot sweep, meant to be invoked by an external scheduler (crontab,
 * systemd timer, k8s CronJob) — e.g. every 15 minutes:
 *   0,15,30,45 * * * * cd /app/apps/api && pnpm jobs:no-show
 *
 * Marks SCHEDULED/CONFIRMED registrations as NO_SHOW once their time slot has
 * ended without a check-in. Idempotent: rows already flipped are excluded by
 * the status filter, so overlapping/repeated runs are harmless.
 */
async function main(): Promise<void> {
  const result = await database.registration.updateMany({
    where: {
      status: { in: ['SCHEDULED', 'CONFIRMED'] },
      checkIn: { is: null },
      timeSlot: { endsAt: { lt: new Date() } },
    },
    data: { status: 'NO_SHOW' },
  });
  console.info(`no-show sweep: ${result.count} registration(s) marked NO_SHOW`);
}

main()
  .catch((error) => {
    console.error('no-show sweep failed', error);
    process.exitCode = 1;
  })
  .finally(() => database.$disconnect());

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AppError } from './common/errors/app.error';
import {
  assertMeasurement,
  parseDomain,
  volumeSchema,
} from './common/helpers/domain-validation';
import {
  assertCanCheckIn,
  assertCanDonate,
  assertCanIssueCertificate,
  assertCanScreen,
} from './common/helpers/workflow-validation';
import { validateTimeSlot } from './modules/time-slots/time-slot.validation';
import { validateCampaign } from './modules/donation-campaigns/campaign.validation';
import { validateDonation } from './modules/donations/donation.validation';
import {
  BACKUP_FORMAT,
  BACKUP_TABLE_NAMES,
  BACKUP_VERSION,
  computeSnapshotChecksum,
  parseAndVerifySnapshot,
  type BackupTables,
} from './modules/backups/backup.validation';
import { backupService } from './modules/backups/backup.service';

const start = new Date('2030-01-01T08:00:00Z');
const end = new Date('2030-01-01T12:00:00Z');
const campaign = { startsAt: start, endsAt: end };
const slot = {
  ...campaign,
  campaignId: 'be483e42-de94-4e04-905d-14b08d329767',
  capacity: 1,
};

test('time slot accepts boundary times, rejects reversed/outside dates and invalid capacity', () => {
  assert.equal(validateTimeSlot(slot, campaign).capacity, 1);
  for (const capacity of [-1, 0, 1.5, NaN, Infinity, 2147483648]) {
    assert.throws(() => validateTimeSlot({ ...slot, capacity }, campaign));
  }
  assert.throws(() => validateTimeSlot({ ...slot, endsAt: start }, campaign));
  assert.throws(() =>
    validateTimeSlot(
      { ...slot, startsAt: new Date(start.getTime() - 1) },
      campaign,
    ),
  );
  assert.throws(() =>
    validateTimeSlot(
      { ...slot, endsAt: new Date(end.getTime() + 1) },
      campaign,
    ),
  );
});

test('campaign validates registration window and strictly positive targets', () => {
  assert.equal(
    validateCampaign({ ...campaign, targetDonors: 120 }).targetDonors,
    120,
  );
  assert.equal(
    validateCampaign({ ...campaign, targetBloodVolumeMl: 45000 })
      .targetBloodVolumeMl,
    45000,
  );
  // Phase 1 rule: a target, when provided, must be greater than zero.
  assert.throws(() => validateCampaign({ ...campaign, targetDonors: 0 }));
  assert.throws(() => validateCampaign({ ...campaign, targetDonors: -1 }));
  assert.throws(() =>
    validateCampaign({ ...campaign, targetBloodVolumeMl: 0 }),
  );
  assert.throws(() =>
    validateCampaign({ ...campaign, targetBloodVolumeMl: -1 }),
  );
  // Reversed registration window.
  assert.throws(() =>
    validateCampaign({
      ...campaign,
      registrationOpensAt: end,
      registrationClosesAt: start,
    }),
  );
  // registrationClosesAt must not be after startsAt.
  assert.throws(() =>
    validateCampaign({
      ...campaign,
      registrationOpensAt: new Date('2029-12-01T08:00:00Z'),
      registrationClosesAt: new Date(start.getTime() + 3600000),
    }),
  );
});

test('volume and measurement validation rejects invalid numbers; bounds come from policy', () => {
  for (const volumeMl of [-350, 0, NaN, Infinity, 1.5])
    assert.throws(() => parseDomain(volumeSchema, { volumeMl }));
  assert.equal(parseDomain(volumeSchema, { volumeMl: 350 }).volumeMl, 350);
  // Synthetic limits test generic numeric validation, not clinical eligibility.
  assertMeasurement(5, 1, 10, true);
  assert.throws(() => assertMeasurement(0, 1, 10));
  assert.throws(() => assertMeasurement(11, 1, 10));
  assert.throws(() => assertMeasurement(5.5, 1, 10, true));
});

test('collection time and confirmation time have distinct order', () => {
  validateDonation({
    startedAt: start,
    completedAt: end,
    donatedAt: new Date(end.getTime() + 1000),
    volumeMl: 350,
  });
  assert.throws(() => validateDonation({ startedAt: end, completedAt: start }));
  assert.throws(() =>
    validateDonation({ startedAt: start, completedAt: end, donatedAt: start }),
  );
});

test('workflow guards reject invalid lifecycle transitions', () => {
  assertCanCheckIn('CONFIRMED');
  assert.throws(() => assertCanCheckIn('CANCELLED'));
  assert.throws(() => assertCanScreen(null));
  assertCanDonate('ELIGIBLE');
  assert.throws(() => assertCanDonate('DEFERRED'));
  assert.throws(() => assertCanDonate('WAITING_REVIEW'));
  assertCanIssueCertificate('COMPLETED');
  assert.throws(() => assertCanIssueCertificate('IN_PROGRESS'));
});

test('backup snapshot verifies SHA-256 checksums and rejects tampered or sanitized restores', async () => {
  const emptyTables = Object.fromEntries(
    BACKUP_TABLE_NAMES.map((name) => [name, []]),
  ) as unknown as BackupTables;
  const payload = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: '2026-11-27T01:00:00.000Z',
    includeCredentials: true,
    restorable: true,
    tables: {
      ...emptyTables,
      roles: [{ id: 'role-1', code: 'SYSTEM_ADMIN', name: 'Quản trị hệ thống' }],
    },
  };
  const checksumSha256 = computeSnapshotChecksum(payload);
  const snapshot = { ...payload, checksumSha256 };

  const verified = parseAndVerifySnapshot({
    ...snapshot,
    createdBy: { id: 'admin-1', email: 'admin@example.local' },
  });
  assert.equal(verified.totalRecords, 1);
  assert.equal(verified.counts.roles, 1);
  assert.equal(verified.snapshot.createdBy?.email, 'admin@example.local');

  assert.throws(
    () =>
      parseAndVerifySnapshot({
        ...snapshot,
        tables: {
          ...snapshot.tables,
          roles: [{ id: 'role-1', code: 'DONOR', name: 'Tampered' }],
        },
      }),
    (error: unknown) =>
      error instanceof AppError && error.code === 'BACKUP_INVALID_FILE',
  );

  const sanitizedPayload = {
    ...payload,
    includeCredentials: false,
    restorable: false,
  };
  const sanitizedSnapshot = {
    ...sanitizedPayload,
    checksumSha256: computeSnapshotChecksum(sanitizedPayload),
  };
  await assert.rejects(
    () =>
      backupService.restore(sanitizedSnapshot, {
        actorId: null,
        ipAddress: null,
        userAgent: null,
      }),
    (error: unknown) =>
      error instanceof AppError && error.code === 'BACKUP_INVALID_FILE',
  );
});

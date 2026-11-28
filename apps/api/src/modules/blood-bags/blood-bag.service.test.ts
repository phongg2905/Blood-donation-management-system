import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import { auditLogService } from '../audit-logs/audit.service';
import { notificationService } from '../notifications/notification.service';
import { bloodBagRepository as repo } from './blood-bag.repository';
import { bloodBagService } from './blood-bag.service';

const ctx = { actorId: 'staff-1', ipAddress: null, userAgent: null };

afterEach(() => mock.restoreAll());

function fakeBag(status: 'COLLECTED' | 'PENDING_TEST' | 'TESTED', bloodType: string | null) {
  const donor = { id: 'donor-1', userId: 'donor-user-1', bloodType: 'A_POSITIVE' };
  const bag = {
    id: 'bag-1', code: 'BAG-1', status, bloodType,
    donation: { screening: { checkIn: { registration: {
      donor, campaign: { name: 'Test campaign' },
    } } } },
  };
  const updates: unknown[] = [];
  const audit: unknown[] = [];
  const notifications: unknown[] = [];
  let updatedBag = { ...bag };
  const tx = {
    bloodBag: {
      updateMany: async ({ data }: { data: unknown }) => { updates.push(data); updatedBag = { ...bag, ...data as object }; return { count: 1 }; },
      findUniqueOrThrow: async () => updatedBag,
    },
    donorProfile: { updateMany: async (input: unknown) => { updates.push(input); return { count: 1 }; } },
  };
  mock.method(repo, 'transaction', async (work: (client: typeof tx) => Promise<unknown>) => work(tx));
  mock.method(repo, 'findByIdTx', async () => bag as never);
  mock.method(auditLogService, 'record', async (input: unknown) => { audit.push(input); return { id: 'audit-1' }; });
  mock.method(notificationService, 'create', async (_client: unknown, input: unknown) => {
    notifications.push(input);
    return { id: 'notification-1' } as never;
  });
  mock.method(notificationService, 'dispatch', async () => undefined);
  return { donor, updates, audit, notifications };
}

test('collection does not accept a suggested blood group as a confirmed bag result', async () => {
  await assert.rejects(
    bloodBagService.recordCollection('screening-1', {
      bags: [{ code: 'BAG-1', volumeMl: 350, bloodType: 'A_POSITIVE' }],
    }, 'staff-1', ctx),
    { code: 'VALIDATION_ERROR' },
  );
});

test('a pending bag cannot receive a final blood group or skip Lab states', async () => {
  const { updates } = fakeBag('COLLECTED', null);
  await assert.rejects(
    bloodBagService.update('bag-1', { bloodType: 'A_POSITIVE' }, ctx),
    { statusCode: 400 },
  );
  await assert.rejects(
    bloodBagService.update('bag-1', { status: 'ACCEPTED', bloodType: 'A_POSITIVE' }, ctx),
    { code: 'BLOOD_BAG_INVALID_TRANSITION' },
  );
  assert.equal(updates.length, 0);
});

test('a Lab result needs confirmation and does not update the donor profile at TESTED', async () => {
  const { donor, updates } = fakeBag('PENDING_TEST', null);
  await assert.rejects(
    bloodBagService.update('bag-1', { status: 'TESTED', bloodType: 'B_POSITIVE' }, ctx),
    { statusCode: 400 },
  );
  await bloodBagService.update('bag-1', {
    status: 'TESTED', bloodType: 'B_POSITIVE', confirmBloodTypeResult: true,
    syncDonorProfile: true,
  }, ctx);
  assert.equal(donor.bloodType, 'A_POSITIVE');
  assert.equal(updates.length, 1);
});

test('a discrepancy blocks acceptance until resolved, then records the reason and profile change', async () => {
  const { updates, audit } = fakeBag('TESTED', 'B_POSITIVE');
  await assert.rejects(
    bloodBagService.update('bag-1', {
      status: 'ACCEPTED', bloodType: 'B_POSITIVE', confirmBloodTypeResult: true, syncDonorProfile: true,
    }, ctx),
    { statusCode: 409 },
  );
  assert.equal(updates.length, 0);
  await bloodBagService.update('bag-1', {
    status: 'ACCEPTED', bloodType: 'B_POSITIVE', confirmBloodTypeResult: true,
    confirmBloodTypeOverride: true,
    bloodTypeOverrideReason: 'Đã xét nghiệm lại mẫu và đối chiếu hồ sơ',
    syncDonorProfile: true,
  }, ctx);
  assert.equal(updates.length, 2);
  assert.deepEqual((audit[0] as { metadata: object }).metadata, {
    previousStatus: 'TESTED', newStatus: 'ACCEPTED',
    previousBloodType: 'B_POSITIVE', newBloodType: 'B_POSITIVE',
    previousDonorBloodType: 'A_POSITIVE', profileSynced: true,
    resultNotified: true,
    discrepancyResolved: true,
    discrepancyReason: 'Đã xét nghiệm lại mẫu và đối chiếu hồ sơ',
    confirmedResult: true,
  });
});

test('a matching result can notify the donor without rewriting the profile', async () => {
  const { updates, notifications } = fakeBag('TESTED', 'A_POSITIVE');
  await bloodBagService.update('bag-1', {
    status: 'ACCEPTED',
    confirmBloodTypeResult: true, syncDonorProfile: true,
  }, ctx);
  assert.equal(updates.length, 1);
  assert.equal(notifications.length, 1);
});

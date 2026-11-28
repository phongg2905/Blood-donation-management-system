import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { backupService } from './backup.service';
import { backupRestoreOperations } from './backup-restore.operations';

const actor = { actorId: 'admin-1', ipAddress: null, userAgent: null };
const result = {
  restored: true,
  restoredFromCreatedAt: '2026-11-27T01:00:00.000Z',
  checksumSha256: 'a'.repeat(64),
  totalRecords: 0,
  counts: {},
};

test('restore status reports the transaction result and blocks a second restore', async (t) => {
  t.after(() => mock.restoreAll());
  mock.method(backupService, 'inspect', () => ({
    valid: true,
    format: 'blood-donation-backup' as const,
    version: 1 as const,
    createdAt: result.restoredFromCreatedAt,
    includeCredentials: true,
    restorable: true,
    checksumSha256: result.checksumSha256,
    counts: {},
    totalRecords: 0,
  }));

  let capturedFilename: string | null | undefined;
  let finish!: (value: typeof result) => void;
  const pending = new Promise<typeof result>((resolve) => {
    finish = resolve;
  });
  mock.method(
    backupService,
    'restore',
    (_input: unknown, _ctx: unknown, options?: { filename?: string | null }) => {
      capturedFilename = options?.filename;
      return pending;
    },
  );

  const operation = backupRestoreOperations.start(
    {},
    actor,
    undefined,
    'snapshot-2026.json',
  );
  assert.equal(operation.status, 'running');
  assert.deepEqual(
    backupRestoreOperations.start({}, actor, operation.id),
    operation,
  );
  assert.throws(() => backupRestoreOperations.start({}, actor), {
    statusCode: 409,
  });
  assert.throws(
    () => backupRestoreOperations.get(operation.id, 'another-admin'),
    { statusCode: 404 },
  );

  finish(result);
  await new Promise(setImmediate);
  assert.equal(capturedFilename, 'snapshot-2026.json');
  const completed = backupRestoreOperations.get(operation.id, actor.actorId);
  assert.equal(completed.status, 'succeeded');
  assert.deepEqual(completed.result, result);
});

test('restore status reports failure and releases the active operation', async (t) => {
  t.after(() => mock.restoreAll());
  mock.method(backupService, 'inspect', () => ({
    valid: true,
    format: 'blood-donation-backup' as const,
    version: 1 as const,
    createdAt: result.restoredFromCreatedAt,
    includeCredentials: true,
    restorable: true,
    checksumSha256: result.checksumSha256,
    counts: {},
    totalRecords: 0,
  }));
  mock.method(backupService, 'restore', async () => {
    throw new Error('database unavailable');
  });
  const log = mock.method(console, 'error', () => {});

  const operation = backupRestoreOperations.start({}, actor);
  await new Promise(setImmediate);
  const completed = backupRestoreOperations.get(operation.id, actor.actorId);
  assert.equal(completed.status, 'failed');
  assert.match(completed.error ?? '', /Khôi phục thất bại/);
  assert.equal(log.mock.callCount(), 1);
  const next = backupRestoreOperations.start({}, actor);
  await new Promise(setImmediate);
  assert.equal(
    backupRestoreOperations.get(next.id, actor.actorId).status,
    'failed',
  );
});

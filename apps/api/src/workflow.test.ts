import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { after, before, mock, test } from 'node:test';
import { ROLE_PERMISSIONS, type ActorCode } from '@blood/shared-types';
import { app } from './app';
import { database } from './config/database';
import { signAccessToken } from './common/security/jwt';
import { notificationService } from './modules/notifications/notification.service';

const server = app.listen(0, '127.0.0.1');
let base: string;
const campaignIds: string[] = [];
const userIds: string[] = [];
const actors: Record<string, { id: string; token: string }> = {};

before(async () => {
  mock.method(notificationService, 'dispatch', async () => undefined);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  for (const [name, role] of Object.entries({
    coordinator: 'COORDINATOR',
    admin: 'SYSTEM_ADMIN',
    checkin: 'DONATION_STAFF',
    screening: 'DONATION_STAFF',
    collection: 'DONATION_STAFF',
    donor: 'DONOR',
    other: 'DONOR',
    third: 'DONOR',
    deferred: 'DONOR',
    rejected: 'DONOR',
  }) as [string, ActorCode][]) {
    const user = await database.user.create({
      data: {
        email: `${randomUUID()}@example.test`,
        fullName: `Workflow ${name}`,
        passwordHash: 'must-never-appear-in-responses',
        roles: {
          create: {
            role: {
              connectOrCreate: {
                where: { code: role },
                create: { code: role, name: role },
              },
            },
          },
        },
        ...(role === 'DONOR' ? { donorProfile: { create: {} } } : {}),
      },
    });
    userIds.push(user.id);
    actors[name] = {
      id: user.id,
      token: signAccessToken({
        sub: user.id,
        roles: [role],
        permissions: [...ROLE_PERMISSIONS[role]],
      }),
    };
  }
});

after(async () => {
  mock.restoreAll();
  // Only remove rows belonging to this suite's UUID fixtures, in FK order.
  await database.$transaction(async (tx) => {
    const registration = { campaignId: { in: campaignIds } };
    const screening = { checkIn: { registration } };
    const donation = { screening };
    await tx.certificate.deleteMany({ where: { donation } });
    await tx.bloodBag.deleteMany({ where: { donation } });
    await tx.donation.deleteMany({ where: donation });
    await tx.screeningTest.deleteMany({ where: { screening } });
    await tx.screening.deleteMany({ where: screening });
    await tx.checkIn.deleteMany({ where: { registration } });
    await tx.healthDeclaration.deleteMany({ where: { registration } });
    await tx.registration.deleteMany({ where: registration });
    await tx.campaignStaff.deleteMany({
      where: { campaignId: { in: campaignIds } },
    });
    await tx.campaignTimeSlot.deleteMany({
      where: { campaignId: { in: campaignIds } },
    });
    await tx.donationCampaign.deleteMany({
      where: { id: { in: campaignIds } },
    });
    await tx.notification.deleteMany({ where: { userId: { in: userIds } } });
    await tx.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
    await tx.donorProfile.deleteMany({ where: { userId: { in: userIds } } });
    await tx.user.deleteMany({ where: { id: { in: userIds } } });
  });
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await database.$disconnect();
});

async function request(
  actor: string,
  method: string,
  path: string,
  input?: unknown,
  expected = 200,
) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${actors[actor]!.token}`,
      'Content-Type': 'application/json',
    },
    ...(input === undefined ? {} : { body: JSON.stringify(input) }),
  });
  const body = await response.json();
  assert.equal(
    response.status,
    expected,
    `${method} ${path}: ${JSON.stringify(body)}`,
  );
  return body;
}
async function campaign(capacity = 3, daysAhead = 7) {
  const startsAt = new Date(Date.now() + daysAhead * 86400000).toISOString();
  const endsAt = new Date(
    new Date(startsAt).getTime() + 4 * 3600000,
  ).toISOString();
  const created = await request(
    'coordinator',
    'POST',
    '/campaigns',
    {
      name: 'Workflow regression fixture',
      location: 'Test fixture',
      startsAt,
      endsAt,
    },
    201,
  );
  const id: string = created.data.id;
  campaignIds.push(id);
  const slot = await request(
    'coordinator',
    'POST',
    `/campaigns/${id}/time-slots`,
    {
      startsAt,
      endsAt,
      capacity,
      label: 'Initial label',
    },
    201,
  );
  await request('coordinator', 'PATCH', `/time-slots/${slot.data.id}`, {
    startsAt,
    label: 'Updated label',
  });
  await request('coordinator', 'POST', `/campaigns/${id}/open`);
  return { id, slotId: slot.data.id as string };
}
async function register(
  actor: string,
  c: { id: string; slotId: string },
  expected = 201,
  answers = { consent: true },
) {
  return request(
    actor,
    'POST',
    '/registrations',
    {
      campaignId: c.id,
      timeSlotId: c.slotId,
      healthDeclaration: { answers },
    },
    expected,
  );
}
async function assign(campaignId: string) {
  for (const [actor, assignment] of [
    ['checkin', 'CHECK_IN'],
    ['screening', 'SCREENING'],
    ['collection', 'COLLECTION'],
  ]) {
    await request(
      'coordinator',
      'POST',
      `/campaigns/${campaignId}/staff`,
      { userId: actors[actor!]!.id, assignment },
      201,
    );
  }
}

let completedCampaign: string;
let completedDonation: string;
let completedBag: string;
test('HTTP workflow persists slots, enforces ownership/duties, and completes collection and reports', async () => {
  const c = await campaign();
  completedCampaign = c.id;
  await assign(c.id);
  const searched = await request(
    'coordinator',
    'GET',
    '/campaigns?search=workflow%20regression%20fixture&sort=desc',
  );
  assert.ok(searched.data.some((row: { id: string }) => row.id === c.id));
  const emptySearch = await request(
    'coordinator',
    'GET',
    '/campaigns?search=nonexistent-workflow-fixture',
  );
  assert.equal(emptySearch.meta.total, 0);
  const slots = await request('donor', 'GET', `/campaigns/${c.id}/time-slots`);
  assert.equal(slots.data[0].label, 'Updated label');
  const reg = await register('donor', c);
  const id = reg.data.id;
  const codeSearch = await request(
    'checkin',
    'GET',
    `/registrations?campaignId=${c.id}&search=REG-${id.slice(0, 8).toUpperCase()}`,
  );
  assert.equal(codeSearch.data.length, 1);
  assert.equal(codeSearch.data[0].id, id);
  await request('other', 'GET', `/registrations/${id}`, undefined, 403);
  await request(
    'other',
    'PATCH',
    `/registrations/${id}/schedule`,
    { timeSlotId: c.slotId },
    403,
  );
  await request('other', 'POST', `/registrations/${id}/cancel`, {}, 403);
  await request(
    'coordinator',
    'POST',
    `/registrations/${id}/check-in`,
    {},
    403,
  );
  await request('screening', 'POST', `/registrations/${id}/check-in`, {}, 403);
  const checkin = await request(
    'checkin',
    'POST',
    `/registrations/${id}/check-in`,
    {},
    201,
  );
  await request('checkin', 'POST', `/registrations/${id}/check-in`, {}, 409);
  await request('donor', 'POST', `/registrations/${id}/cancel`, {}, 409);
  await request('checkin', 'POST', `/registrations/${id}/no-show`, {}, 409);
  await request(
    'collection',
    'POST',
    '/screenings',
    { checkInId: checkin.data.id },
    403,
  );
  const screening = await request(
    'screening',
    'POST',
    '/screenings',
    {
      checkInId: checkin.data.id,
      measurements: { weightKg: 60, indicatedVolumeMl: 350 },
      tests: [],
    },
    201,
  );
  await request(
    'checkin',
    'POST',
    `/screenings/${screening.data.id}/review`,
    { status: 'ELIGIBLE' },
    403,
  );
  await request(
    'screening',
    'POST',
    `/screenings/${screening.data.id}/review`,
    { status: 'ELIGIBLE', indicatedVolumeMl: 350 },
  );
  const bagInput = { bags: [{ code: `test-${randomUUID()}`, volumeMl: 350 }] };
  await request(
    'checkin',
    'POST',
    `/screenings/${screening.data.id}/blood-bags`,
    bagInput,
    403,
  );
  const collection = await request(
    'collection',
    'POST',
    `/screenings/${screening.data.id}/blood-bags`,
    bagInput,
    201,
  );
  const bag = collection.data.bloodBags[0];
  completedBag = bag.id;
  completedDonation = bag.donationId;
  assert.equal(bag.status, 'COLLECTED');
  assert.equal(bag.code, bagInput.bags[0]!.code.toUpperCase());
  assert.ok(bag.collectedAt);
  await request(
    'collection',
    'POST',
    `/screenings/${screening.data.id}/blood-bags`,
    bagInput,
    409,
  );
  await request(
    'collection',
    'PATCH',
    `/blood-bags/${bag.id}`,
    { status: 'ACCEPTED' },
    409,
  );
  await request('collection', 'PATCH', `/blood-bags/${bag.id}`, {
    status: 'PENDING_TEST',
  });
  await request(
    'collection',
    'PATCH',
    `/blood-bags/${bag.id}`,
    { status: 'TESTED' },
    400,
  );
  await request('collection', 'PATCH', `/blood-bags/${bag.id}`, {
    status: 'TESTED',
    bloodType: 'O_POSITIVE',
    confirmBloodTypeResult: true,
  });
  await request('collection', 'PATCH', `/blood-bags/${bag.id}`, {
    status: 'ACCEPTED',
    volumeMl: 340,
    confirmBloodTypeResult: true,
  });
  await request(
    'collection',
    'DELETE',
    `/blood-bags/${bag.id}`,
    undefined,
    409,
  );
  const bags = await request(
    'collection',
    'GET',
    `/blood-bags?campaignId=${c.id}`,
  );
  assert.ok(!JSON.stringify(bags).includes('passwordHash'));
  const report = await request(
    'coordinator',
    'GET',
    `/reports/donations?campaignId=${c.id}`,
  );
  assert.equal(report.data.totals.volumeMl, 340);
  assert.equal(report.data.totals.donations, 1);
  const history = await request('donor', 'GET', '/donors/me/history');
  assert.equal(
    history.data.find((item: { id: string }) => item.id === id).volumeMl,
    340,
  );
});

test('capacity races and failed cancelled-registration reuse roll back declarations and seats', async () => {
  // Move far from the successful donation to exercise scheduling rather than interval guards.
  const c = await campaign(1, 180);
  const original = await register('other', c);
  await request('other', 'POST', `/registrations/${original.data.id}/cancel`, {
    reason: 'Cancel fixture',
  });
  await register('third', c);
  const failure = await register('other', c, 409, { consent: false });
  assert.equal(failure.error.code, 'TIME_SLOT_FULL');
  const stored = await database.registration.findUniqueOrThrow({
    where: { id: original.data.id },
    include: { healthDeclaration: true },
  });
  assert.equal(stored.status, 'CANCELLED');
  assert.deepEqual(stored.healthDeclaration?.answers, { consent: true });
  await request(
    'third',
    'POST',
    `/registrations/${(await request('third', 'GET', '/registrations/my')).data[0].id}/cancel`,
    {},
  );
  const results = await Promise.all([
    fetch(`${base}/registrations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${actors.other!.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        campaignId: c.id,
        timeSlotId: c.slotId,
        healthDeclaration: { answers: {} },
      }),
    }),
    fetch(`${base}/registrations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${actors.third!.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        campaignId: c.id,
        timeSlotId: c.slotId,
        healthDeclaration: { answers: {} },
      }),
    }),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  assert.equal(
    await database.registration.count({
      where: { campaignId: c.id, status: 'SCHEDULED' },
    }),
    1,
  );
});

test('administration and certificate APIs preserve permissions and hide password hashes', async () => {
  const users = await request('admin', 'GET', '/users?search=Workflow');
  assert.ok(users.data.length > 0);
  assert.ok(!JSON.stringify(users).includes('passwordHash'));
  const updated = await request(
    'admin',
    'PATCH',
    `/users/${actors.donor!.id}`,
    { fullName: 'Updated workflow donor' },
  );
  assert.ok(!JSON.stringify(updated).includes('passwordHash'));
  await request('donor', 'GET', '/users', undefined, 403);
  await request('admin', 'POST', '/campaigns', { name: 'Forbidden' }, 403);
  const certificate = await database.certificate.create({
    data: { donationId: completedDonation, code: randomUUID() },
  });
  const path = `/certificates/${certificate.id}/file`;
  await request(
    'other',
    'POST',
    path,
    { fileUrl: 'https://example.test/certificate.jpg' },
    403,
  );
  await request(
    'coordinator',
    'POST',
    path,
    { fileUrl: 'https://example.test/certificate.jpg' },
    403,
  );
  await request('donor', 'POST', path, {
    fileUrl: 'https://example.test/certificate.jpg',
  });
  const certificates = await request('donor', 'GET', '/certificates');
  assert.ok(!JSON.stringify(certificates).includes('passwordHash'));
  await request('admin', 'POST', `/certificates/${certificate.id}/revoke`, {
    reason: 'Test revocation',
  });
  await request(
    'donor',
    'POST',
    path,
    { fileUrl: 'https://example.test/certificate.jpg' },
    409,
  );
  await request(
    'admin',
    'PUT',
    '/settings/workflow_invalid_fixture',
    { value: 123 },
    400,
  );
  await request(
    'checkin',
    'GET',
    '/registrations?status=INVALID',
    undefined,
    400,
  );
  await request(
    'collection',
    'GET',
    '/blood-bags?status=INVALID',
    undefined,
    400,
  );
  await request(
    'collection',
    'GET',
    '/certificates?status=INVALID',
    undefined,
    400,
  );
  assert.ok(completedCampaign && completedBag);
});

test('deferred and ineligible screenings block collection and inactive slots block booking', async () => {
  const c = await campaign(3, 370);
  await assign(c.id);
  for (const [actor, status] of [
    ['deferred', 'DEFERRED'],
    ['rejected', 'INELIGIBLE'],
  ]) {
    const reg = await register(actor!, c);
    const checkin = await request(
      'checkin',
      'POST',
      `/registrations/${reg.data.id}/check-in`,
      {},
      201,
    );
    const screening = await request(
      'screening',
      'POST',
      '/screenings',
      { checkInId: checkin.data.id, measurements: {}, tests: [] },
      201,
    );
    await request(
      'screening',
      'POST',
      `/screenings/${screening.data.id}/review`,
      { status },
      400,
    );
    await request(
      'screening',
      'POST',
      `/screenings/${screening.data.id}/review`,
      {
        status,
        decisionReason: 'Regression fixture',
        ...(status === 'DEFERRED'
          ? {
              deferredUntil: new Date(
                Date.now() + 500 * 86400000,
              ).toISOString(),
            }
          : {}),
      },
    );
    const blocked = await request(
      'collection',
      'POST',
      `/screenings/${screening.data.id}/blood-bags`,
      { bags: [{ code: randomUUID(), volumeMl: 350 }] },
      409,
    );
    assert.equal(blocked.error.code, 'SCREENING_NOT_ELIGIBLE');
  }
  const later = await campaign(3, 450);
  const blockedDeferral = await register('deferred', later, 409);
  assert.equal(blockedDeferral.error.code, 'SCREENING_NOT_ELIGIBLE');
  await request(
    'coordinator',
    'POST',
    `/time-slots/${later.slotId}/deactivate`,
  );
  const blockedInactive = await register('other', later, 409);
  assert.equal(blockedInactive.error.code, 'TIME_SLOT_INACTIVE');
  assert.equal(
    await database.registration.count({ where: { campaignId: later.id } }),
    0,
  );
});

test('malformed resource IDs, screening bodies and notification pagination return validation errors', async () => {
  await request('donor', 'GET', '/registrations/not-a-uuid', undefined, 400);
  await request(
    'collection',
    'GET',
    '/blood-bags/eligible?campaignId=invalid',
    undefined,
    400,
  );
  await request('screening', 'POST', '/screenings', {}, 400);
  await request('donor', 'GET', '/notifications?page=0', undefined, 400);
  await request('donor', 'GET', '/notifications?limit=invalid', undefined, 400);
  const page = await request('donor', 'GET', '/notifications?page=1&limit=1');
  assert.equal(typeof page.meta.page, 'number');
  assert.equal(page.data.length, 1);
  await request(
    'other',
    'PATCH',
    `/notifications/${page.data[0].id}/read`,
    {},
    404,
  );
  await request('donor', 'PATCH', `/notifications/${page.data[0].id}/read`, {});
});

test('duplicate concurrent submissions create one registration without internal errors', async () => {
  const c = await campaign(3, 700);
  const input = {
    campaignId: c.id,
    timeSlotId: c.slotId,
    healthDeclaration: { answers: {} },
  };
  const responses = await Promise.all(
    [0, 1].map(() =>
      fetch(`${base}/registrations`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${actors.donor!.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      }),
    ),
  );
  assert.deepEqual(responses.map((r) => r.status).sort(), [201, 409]);
  assert.equal(
    await database.registration.count({ where: { campaignId: c.id } }),
    1,
  );
});

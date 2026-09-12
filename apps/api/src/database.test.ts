import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, test } from 'node:test';
import { Prisma } from '@prisma/client';
import { database } from './config/database';
import { timeSlotService } from './modules/time-slots/time-slot.service';

after(async () => {
  await database.$disconnect();
});

async function rollback(work: (tx: Prisma.TransactionClient) => Promise<void>) {
  const done = new Error('ROLLBACK_TEST_FIXTURE');
  try {
    await database.$transaction(
      async (tx) => {
        await work(tx);
        throw done;
      },
      { timeout: 15000 },
    );
  } catch (error) {
    if (error !== done) throw error;
  }
}

async function fixture(tx: Prisma.TransactionClient) {
  const staff = await tx.user.create({
    data: { email: `${randomUUID()}@example.test`, fullName: 'Test staff' },
  });
  const donor = await tx.donorProfile.create({
    data: {
      user: {
        create: {
          email: `${randomUUID()}@example.test`,
          fullName: 'Test donor',
        },
      },
      citizenId: randomUUID(),
      gender: 'OTHER',
      address: 'Test address',
    },
  });
  const campaign = await tx.donationCampaign.create({
    data: {
      name: 'Refinement test',
      location: 'Test',
      startsAt: new Date('2035-01-01T08:00:00Z'),
      endsAt: new Date('2035-01-01T12:00:00Z'),
      status: 'OPEN',
    },
  });
  const registration = await tx.registration.create({
    data: { donorId: donor.id, campaignId: campaign.id },
  });
  const checkIn = await tx.checkIn.create({
    data: { registrationId: registration.id, checkedInById: staff.id },
  });
  const screening = await tx.screening.create({
    data: {
      checkInId: checkIn.id,
      screenedById: staff.id,
      status: 'DEFERRED',
      decisionReason: 'Test reason',
      deferredUntil: new Date('2035-02-01T00:00:00Z'),
    },
  });
  return { staff, donor, campaign, registration, checkIn, screening };
}

test('new actor relations, JSON answers, statuses and revocation round-trip', async () => {
  await rollback(async (tx) => {
    const f = await fixture(tx);
    const answers = {
      hasChronicDisease: false,
      currentMedications: [],
      recentIllness: false,
    };
    const declaration = await tx.healthDeclaration.create({
      data: { registrationId: f.registration.id, answers },
    });
    assert.deepEqual(declaration.answers, answers);
    await tx.screening.update({
      where: { id: f.screening.id },
      data: { status: 'ELIGIBLE', deferredUntil: null },
    });
    const donation = await tx.donation.create({
      data: {
        screeningId: f.screening.id,
        performedById: f.staff.id,
        status: 'COMPLETED',
        volumeMl: 350,
      },
    });
    const bag = await tx.bloodBag.create({
      data: { donationId: donation.id, code: randomUUID(), volumeMl: 350 },
    });
    assert.equal(bag.status, 'CREATED');
    const certificate = await tx.certificate.create({
      data: { donationId: donation.id, code: randomUUID() },
    });
    assert.equal(certificate.status, 'ACTIVE');
    await tx.certificate.update({
      where: { id: certificate.id },
      data: {
        status: 'REVOKED',
        revokedAt: new Date(),
        revokeReason: 'Correction',
      },
    });
    assert.equal(
      await tx.certificate.count({ where: { donationId: donation.id } }),
      1,
    );
    const staff = await tx.user.findUniqueOrThrow({
      where: { id: f.staff.id },
      include: {
        performedCheckIns: true,
        performedScreenings: true,
        performedDonations: true,
      },
    });
    assert.equal(staff.performedCheckIns.length, 1);
    assert.equal(staff.performedScreenings.length, 1);
    assert.equal(staff.performedDonations.length, 1);
    await assert.rejects(tx.user.delete({ where: { id: f.staff.id } }), {
      code: 'P2003',
    });
  });
});

test('duplicate screening test codes and citizen IDs are rejected', async () => {
  await rollback(async (tx) => {
    const f = await fixture(tx);
    const data = {
      screeningId: f.screening.id,
      code: 'WEIGHT_KG',
      result: '60',
      unit: 'kg',
    };
    await tx.screeningTest.create({ data });
    await assert.rejects(tx.screeningTest.create({ data }), { code: 'P2002' });
  });
  await rollback(async (tx) => {
    const f = await fixture(tx);
    await assert.rejects(
      tx.donorProfile.create({
        data: {
          citizenId: f.donor.citizenId,
          user: {
            create: {
              email: `${randomUUID()}@example.test`,
              fullName: 'Duplicate citizen test',
            },
          },
        },
      }),
      { code: 'P2002' },
    );
  });
});

test('composite FK still rejects a time slot from another campaign', async () => {
  await rollback(async (tx) => {
    const f = await fixture(tx);
    const other = await tx.donationCampaign.create({
      data: {
        name: 'Other',
        location: 'Test',
        startsAt: f.campaign.startsAt,
        endsAt: f.campaign.endsAt,
      },
    });
    const slot = await tx.campaignTimeSlot.create({
      data: {
        campaignId: other.id,
        startsAt: other.startsAt,
        endsAt: other.endsAt,
        capacity: 1,
      },
    });
    await assert.rejects(
      tx.registration.update({
        where: { id: f.registration.id },
        data: { timeSlotId: slot.id },
      }),
      { code: 'P2003' },
    );
  });
});

test('concurrent scheduling cannot overbook the final place', async () => {
  const fixture = await database.$transaction(async (tx) => {
    const campaign = await tx.donationCampaign.create({
      data: {
        name: 'Capacity concurrency test',
        location: 'Test',
        startsAt: new Date(Date.now() + 86400000),
        endsAt: new Date(Date.now() + 90000000),
        status: 'OPEN',
      },
    });
    const registrations = [];
    const userIds: string[] = [];
    for (let i = 0; i < 2; i++) {
      const donor = await tx.donorProfile.create({
        data: {
          user: {
            create: {
              email: `${randomUUID()}@example.test`,
              fullName: 'Capacity test',
            },
          },
        },
      });
      userIds.push(donor.userId);
      registrations.push(
        await tx.registration.create({
          data: { donorId: donor.id, campaignId: campaign.id },
        }),
      );
    }
    return { campaign, registrations, userIds };
  });
  try {
    const slot = await timeSlotService.create({
      campaignId: fixture.campaign.id,
      startsAt: fixture.campaign.startsAt,
      endsAt: fixture.campaign.endsAt,
      capacity: 1,
    });
    const results = await Promise.allSettled(
      fixture.registrations.map((registration) =>
        timeSlotService.schedule({
          registrationId: registration.id,
          timeSlotId: slot.id,
        }),
      ),
    );
    assert.equal(
      results.filter((result) => result.status === 'fulfilled').length,
      1,
    );
    const failure = results.find((result) => result.status === 'rejected');
    assert.ok(failure && failure.status === 'rejected');
    assert.equal((failure.reason as Error).message, 'Time slot is full');
    assert.equal(
      await database.registration.count({ where: { timeSlotId: slot.id } }),
      1,
    );
  } finally {
    // Only delete records belonging to this test's generated IDs.
    await database.$transaction(async (tx) => {
      await tx.registration.deleteMany({
        where: { campaignId: fixture.campaign.id },
      });
      await tx.campaignTimeSlot.deleteMany({
        where: { campaignId: fixture.campaign.id },
      });
      await tx.donationCampaign.delete({ where: { id: fixture.campaign.id } });
      await tx.donorProfile.deleteMany({
        where: { userId: { in: fixture.userIds } },
      });
      await tx.user.deleteMany({ where: { id: { in: fixture.userIds } } });
    });
  }
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { z } from 'zod';
import {
  AUDIT_ACTIONS,
  CAMPAIGN_TRANSITIONS,
  PERMISSION_CODES,
  ROLE_CODES,
  ROLE_PERMISSIONS,
  SCREENING_TEST_CATALOG,
  canTransition,
  isPermissionCode,
  isRoleCode,
  type PermissionCode,
  type RoleCode,
} from '@blood/shared-types';
import { AppError } from './common/errors/app.error';
import {
  assertMeasurement,
  parseDomain,
  volumeSchema,
} from './common/helpers/domain-validation';
import {
  failureResponse,
  listResponse,
  paginationMeta,
  resolvePagination,
  successResponse,
  zodFields,
} from './common/helpers/response';
import {
  assertCanCheckIn,
  assertCanDonate,
  assertCanIssueCertificate,
  assertCanScreen,
} from './common/helpers/workflow-validation';
import {
  hashOpaqueToken,
  hashPassword,
  verifyPassword,
} from './common/security/password';
import {
  assertCampaignAcceptsRegistration,
  assertCampaignEditable,
  assertCampaignTransition,
  assertRegistrationWindowOpen,
  validateCampaign,
} from './modules/donation-campaigns/campaign.validation';
import {
  assertBloodBagTransition,
  assertBagVolumesReconcile,
} from './modules/blood-bags/blood-bag.validation';
import {
  assertCanRevokeCertificate,
  assertCertificateIssuable,
} from './modules/certificates/certificate.validation';
import {
  assertCanStartDonation,
  assertDonationTransition,
  validateDonation,
  validateDonationCompletion,
} from './modules/donations/donation.validation';
import {
  assertNoScheduleOverlap,
  assertRegistrationTransition,
  assertSingleRegistrationPerCampaign,
  resolveScheduleOutcome,
  validateCreateRegistration,
  validateScheduleRegistration,
} from './modules/registrations/registration.validation';
import {
  assertScreeningEligibleForDonation,
  validateScreeningMeasurements,
  validateScreeningReview,
  validateScreeningTests,
  assertScreeningTransition,
} from './modules/screenings/screening.validation';
import {
  assertTimeSlotActive,
  assertTimeSlotHasCapacity,
  validateTimeSlot,
} from './modules/time-slots/time-slot.validation';

const codeOf = (error: unknown): string | undefined =>
  error instanceof AppError ? error.code : undefined;

/** Asserts a rule violation surfaces the specific contract error code. */
function throwsCode(run: () => unknown, code: string): void {
  assert.throws(run, (error: unknown) => codeOf(error) === code);
}

const has = (role: RoleCode, permission: PermissionCode): boolean =>
  (ROLE_PERMISSIONS[role] as readonly string[]).includes(permission);

/** Roles holding a permission, in ROLE_CODES order. */
const rolesWith = (permission: PermissionCode): RoleCode[] =>
  ROLE_CODES.filter((role) => has(role, permission));

const start = new Date('2030-01-01T08:00:00Z');
const end = new Date('2030-01-01T12:00:00Z');

/* -------------------------------------------------------------------------- */
/* 1. Roles and permissions                                                   */
/* -------------------------------------------------------------------------- */

test('the system exposes exactly five roles and no legacy role codes', () => {
  assert.deepEqual(
    [...ROLE_CODES],
    [
      'DONOR',
      'RECEPTION_STAFF',
      'MEDICAL_STAFF',
      'BLOOD_COLLECTION_STAFF',
      'ADMIN',
    ],
  );
  for (const legacy of ['SCREENING_STAFF', 'DOCTOR', 'COORDINATOR']) {
    assert.equal(isRoleCode(legacy), false, `${legacy} must not be a role`);
  }
});

test('role-permission mapping is complete, valid and distinct', () => {
  assert.equal(new Set(PERMISSION_CODES).size, PERMISSION_CODES.length);

  const assigned = new Set<PermissionCode>();
  for (const role of ROLE_CODES) {
    const permissions = ROLE_PERMISSIONS[role];
    assert.ok(permissions.length > 0, `${role} must own permissions`);
    for (const permission of permissions) {
      assert.equal(
        isPermissionCode(permission),
        true,
        `${role} references unknown permission ${permission}`,
      );
      assigned.add(permission);
    }
  }

  // Every permission in the catalogue is granted to at least one role.
  for (const permission of PERMISSION_CODES) {
    assert.equal(assigned.has(permission), true, `${permission} is unassigned`);
  }

  // ADMIN is the superset and keeps every permission.
  assert.equal(ROLE_PERMISSIONS.ADMIN.length, PERMISSION_CODES.length);
  for (const permission of PERMISSION_CODES) {
    assert.equal(
      ROLE_PERMISSIONS.ADMIN.includes(permission),
      true,
      `ADMIN must own ${permission}`,
    );
  }

  // No duplicate entries inside a role.
  for (const role of ROLE_CODES) {
    assert.equal(
      new Set(ROLE_PERMISSIONS[role]).size,
      ROLE_PERMISSIONS[role].length,
      `${role} has duplicate permissions`,
    );
  }

  // DONOR: self-service only.
  assert.equal(has('DONOR', 'registration.create'), true);
  assert.equal(has('DONOR', 'registration.reschedule'), true);
  assert.equal(has('DONOR', 'registration.cancel'), true);
  assert.equal(has('DONOR', 'health_declaration.update'), true);
  assert.equal(has('DONOR', 'user.manage'), false);
  assert.equal(has('DONOR', 'registration.checkin'), false);
  assert.equal(has('DONOR', 'screening.read'), false);
  assert.equal(has('DONOR', 'donation.start'), false);

  // MEDICAL_STAFF: pre-donation medicine only.
  assert.equal(has('MEDICAL_STAFF', 'screening.read'), true);
  assert.equal(has('MEDICAL_STAFF', 'screening.create'), true);
  assert.equal(has('MEDICAL_STAFF', 'screening.update'), true);
  assert.equal(has('MEDICAL_STAFF', 'screening.review'), true);
  assert.equal(has('MEDICAL_STAFF', 'health_declaration.read'), true);
  assert.equal(has('MEDICAL_STAFF', 'donation.read'), true);
  assert.equal(has('MEDICAL_STAFF', 'reaction.read'), true);
  assert.equal(has('MEDICAL_STAFF', 'certificate.read'), true);
  for (const removed of [
    'donation.start',
    'donation.complete',
    'donation.stop',
    'bloodbag.create',
    'bloodbag.update_status',
    'reaction.create',
    'certificate.issue',
    'certificate.revoke',
    'registration.checkin',
    'registration.mark_no_show',
    'health_declaration.update',
  ] as const) {
    assert.equal(
      has('MEDICAL_STAFF', removed),
      false,
      `MEDICAL_STAFF must not own ${removed}`,
    );
  }

  // BLOOD_COLLECTION_STAFF: everything after an ELIGIBLE conclusion.
  for (const owned of [
    'screening.read',
    'donation.read',
    'donation.start',
    'donation.complete',
    'donation.stop',
    'bloodbag.read',
    'bloodbag.create',
    'bloodbag.update_status',
    'reaction.read',
    'reaction.create',
    'certificate.read',
    'certificate.issue',
  ] as const) {
    assert.equal(
      has('BLOOD_COLLECTION_STAFF', owned),
      true,
      `BLOOD_COLLECTION_STAFF must own ${owned}`,
    );
  }
  assert.equal(has('BLOOD_COLLECTION_STAFF', 'screening.review'), false);
  assert.equal(has('BLOOD_COLLECTION_STAFF', 'screening.create'), false);
  assert.equal(has('BLOOD_COLLECTION_STAFF', 'screening.update'), false);
  assert.equal(has('BLOOD_COLLECTION_STAFF', 'certificate.revoke'), false);
  assert.equal(has('BLOOD_COLLECTION_STAFF', 'registration.checkin'), false);

  // RECEPTION_STAFF: arrival only.
  assert.equal(has('RECEPTION_STAFF', 'registration.read'), true);
  assert.equal(has('RECEPTION_STAFF', 'registration.checkin'), true);
  assert.equal(has('RECEPTION_STAFF', 'registration.mark_no_show'), true);
  assert.equal(has('RECEPTION_STAFF', 'health_declaration.read'), true);
  assert.equal(has('RECEPTION_STAFF', 'registration.create'), false);
  assert.equal(has('RECEPTION_STAFF', 'screening.review'), false);
  assert.equal(has('RECEPTION_STAFF', 'screening.create'), false);
  assert.equal(has('RECEPTION_STAFF', 'donation.start'), false);
  assert.equal(has('RECEPTION_STAFF', 'bloodbag.create'), false);
  assert.equal(has('RECEPTION_STAFF', 'bloodbag.update_status'), false);
  assert.equal(has('RECEPTION_STAFF', 'reaction.create'), false);
  assert.equal(has('RECEPTION_STAFF', 'certificate.issue'), false);
  assert.equal(has('RECEPTION_STAFF', 'certificate.revoke'), false);
});

test('sensitive permissions are owned by exactly the right operational role', () => {
  assert.deepEqual(rolesWith('certificate.revoke'), ['ADMIN']);
  assert.deepEqual(rolesWith('certificate.issue'), [
    'BLOOD_COLLECTION_STAFF',
    'ADMIN',
  ]);
  assert.deepEqual(rolesWith('certificate.read'), [
    'DONOR',
    'MEDICAL_STAFF',
    'BLOOD_COLLECTION_STAFF',
    'ADMIN',
  ]);
  assert.deepEqual(rolesWith('reaction.create'), [
    'BLOOD_COLLECTION_STAFF',
    'ADMIN',
  ]);
  assert.deepEqual(rolesWith('reaction.read'), [
    'DONOR',
    'MEDICAL_STAFF',
    'BLOOD_COLLECTION_STAFF',
    'ADMIN',
  ]);
  assert.deepEqual(rolesWith('screening.review'), ['MEDICAL_STAFF', 'ADMIN']);
  assert.deepEqual(rolesWith('donation.start'), [
    'BLOOD_COLLECTION_STAFF',
    'ADMIN',
  ]);
  assert.deepEqual(rolesWith('bloodbag.create'), [
    'BLOOD_COLLECTION_STAFF',
    'ADMIN',
  ]);
  assert.deepEqual(rolesWith('registration.checkin'), [
    'RECEPTION_STAFF',
    'ADMIN',
  ]);
  assert.deepEqual(rolesWith('health_declaration.create'), ['DONOR', 'ADMIN']);
  assert.deepEqual(rolesWith('registration.create'), ['DONOR', 'ADMIN']);

  // No mutating duty is shared by two non-admin roles.
  const duties: PermissionCode[] = [
    'registration.create',
    'registration.reschedule',
    'registration.cancel',
    'registration.checkin',
    'registration.mark_no_show',
    'health_declaration.create',
    'health_declaration.update',
    'screening.create',
    'screening.update',
    'screening.review',
    'donation.start',
    'donation.complete',
    'donation.stop',
    'bloodbag.create',
    'bloodbag.update_status',
    'reaction.create',
    'certificate.issue',
    'certificate.revoke',
  ];
  for (const permission of duties) {
    const owners = rolesWith(permission).filter((role) => role !== 'ADMIN');
    assert.ok(
      owners.length <= 1,
      `${permission} is owned by multiple non-admin roles: ${owners.join(', ')}`,
    );
  }
  // Shared *read* access stays available to every party that needs it.
  for (const permission of [
    'campaign.read',
    'timeslot.read',
    'registration.read',
    'screening.read',
    'donation.read',
  ] as const) {
    assert.ok(
      rolesWith(permission).filter((role) => role !== 'ADMIN').length >= 2,
      `${permission} should stay readable across staff roles`,
    );
  }
});

test('collection staff own the donation chain, gated by an ELIGIBLE screening', () => {
  const collectionOwnsDonation = rolesWith('donation.start');
  assert.deepEqual(collectionOwnsDonation, ['BLOOD_COLLECTION_STAFF', 'ADMIN']);
  assert.equal(
    rolesWith('screening.review').includes('BLOOD_COLLECTION_STAFF'),
    false,
    'collection staff must not conclude screening',
  );

  // An ELIGIBLE conclusion is the mandatory gate before starting a donation.
  assertCanStartDonation({ checkInId: 'c1', screeningStatus: 'ELIGIBLE' });
  for (const status of [
    'PENDING',
    'WAITING_REVIEW',
    'INELIGIBLE',
    'DEFERRED',
  ] as const) {
    throwsCode(
      () =>
        assertCanStartDonation({ checkInId: 'c1', screeningStatus: status }),
      'SCREENING_NOT_ELIGIBLE',
    );
  }

  // Certificate issuing stays tied to a COMPLETED donation.
  assertCanIssueCertificate('COMPLETED');
  throwsCode(
    () => assertCanIssueCertificate('STOPPED'),
    'DONATION_NOT_COMPLETED',
  );
});

test('state transition maps reject impossible and terminal changes', () => {
  assert.equal(canTransition(CAMPAIGN_TRANSITIONS, 'DRAFT', 'OPEN'), true);
  assert.equal(canTransition(CAMPAIGN_TRANSITIONS, 'OPEN', 'CLOSED'), true);
  assert.equal(
    canTransition(CAMPAIGN_TRANSITIONS, 'CLOSED', 'COMPLETED'),
    true,
  );
  assert.equal(canTransition(CAMPAIGN_TRANSITIONS, 'COMPLETED', 'OPEN'), false);
  assert.equal(canTransition(CAMPAIGN_TRANSITIONS, 'CANCELLED', 'OPEN'), false);
  assert.equal(canTransition(CAMPAIGN_TRANSITIONS, 'CLOSED', 'DRAFT'), false);

  assertCampaignTransition('DRAFT', 'OPEN');
  throwsCode(
    () => assertCampaignTransition('COMPLETED', 'OPEN'),
    'CAMPAIGN_INVALID_TRANSITION',
  );
  throwsCode(
    () => assertCampaignTransition('CANCELLED', 'OPEN'),
    'CAMPAIGN_INVALID_TRANSITION',
  );

  assertRegistrationTransition('PENDING', 'SCHEDULED');
  assertRegistrationTransition('WAITLISTED', 'SCHEDULED');
  assertRegistrationTransition('CONFIRMED', 'COMPLETED');
  throwsCode(
    () => assertRegistrationTransition('PENDING', 'CONFIRMED'),
    'REGISTRATION_INVALID_TRANSITION',
  );
  throwsCode(
    () => assertRegistrationTransition('COMPLETED', 'SCHEDULED'),
    'REGISTRATION_INVALID_TRANSITION',
  );
  throwsCode(
    () => assertRegistrationTransition('NO_SHOW', 'CONFIRMED'),
    'REGISTRATION_INVALID_TRANSITION',
  );

  assertScreeningTransition('PENDING', 'WAITING_REVIEW');
  assertScreeningTransition('WAITING_REVIEW', 'DEFERRED');
  throwsCode(
    () => assertScreeningTransition('PENDING', 'ELIGIBLE'),
    'SCREENING_INVALID_TRANSITION',
  );

  assertDonationTransition('PENDING', 'IN_PROGRESS');
  assertDonationTransition('IN_PROGRESS', 'STOPPED');
  throwsCode(
    () => assertDonationTransition('STOPPED', 'COMPLETED'),
    'DONATION_INVALID_TRANSITION',
  );

  assertBloodBagTransition('TESTED', 'ACCEPTED');
  assertBloodBagTransition('REJECTED', 'DISCARDED');
  throwsCode(
    () => assertBloodBagTransition('CREATED', 'TESTED'),
    'BLOOD_BAG_INVALID_TRANSITION',
  );
  throwsCode(
    () => assertBloodBagTransition('DISCARDED', 'ACCEPTED'),
    'BLOOD_BAG_INVALID_TRANSITION',
  );
});

/* -------------------------------------------------------------------------- */
/* 2. Campaign rules                                                          */
/* -------------------------------------------------------------------------- */

test('campaign rejects invalid dates, targets and frozen transitions', () => {
  assert.equal(
    validateCampaign({ startsAt: start, endsAt: end, targetDonors: 100 })
      .targetDonors,
    100,
  );

  // startsAt must precede endsAt
  throwsCode(
    () => validateCampaign({ startsAt: end, endsAt: start }),
    'CAMPAIGN_DATE_INVALID',
  );
  // registration window order
  throwsCode(
    () =>
      validateCampaign({
        startsAt: start,
        endsAt: end,
        registrationOpensAt: new Date('2029-12-31T08:00:00Z'),
        registrationClosesAt: new Date('2029-12-30T08:00:00Z'),
      }),
    'CAMPAIGN_DATE_INVALID',
  );
  // registrationClosesAt must not be after startsAt
  throwsCode(
    () =>
      validateCampaign({
        startsAt: start,
        endsAt: end,
        registrationOpensAt: new Date('2029-12-01T08:00:00Z'),
        registrationClosesAt: new Date('2030-01-01T09:00:00Z'),
      }),
    'CAMPAIGN_DATE_INVALID',
  );
  // targets must be > 0 when provided
  throwsCode(
    () => validateCampaign({ startsAt: start, endsAt: end, targetDonors: 0 }),
    'CAMPAIGN_TARGET_INVALID',
  );
  throwsCode(
    () =>
      validateCampaign({
        startsAt: start,
        endsAt: end,
        targetBloodVolumeMl: 0,
      }),
    'CAMPAIGN_TARGET_INVALID',
  );

  // registrationClosesAt == startsAt is allowed
  validateCampaign({
    startsAt: start,
    endsAt: end,
    registrationOpensAt: new Date('2029-12-01T08:00:00Z'),
    registrationClosesAt: start,
  });

  assertCampaignAcceptsRegistration('OPEN');
  throwsCode(
    () => assertCampaignAcceptsRegistration('DRAFT'),
    'CAMPAIGN_NOT_OPEN',
  );
  throwsCode(
    () => assertCampaignAcceptsRegistration('CLOSED'),
    'REGISTRATION_CLOSED',
  );
  throwsCode(
    () => assertCampaignAcceptsRegistration('CANCELLED'),
    'REGISTRATION_CLOSED',
  );
  throwsCode(
    () => assertCampaignAcceptsRegistration('COMPLETED'),
    'REGISTRATION_CLOSED',
  );

  assertCampaignEditable('OPEN');
  throwsCode(
    () => assertCampaignEditable('COMPLETED'),
    'CAMPAIGN_NOT_EDITABLE',
  );

  const now = new Date('2030-01-01T09:00:00Z');
  assertRegistrationWindowOpen(
    { registrationOpensAt: null, registrationClosesAt: null },
    now,
  );
  throwsCode(
    () =>
      assertRegistrationWindowOpen(
        {
          registrationOpensAt: new Date('2030-01-02T00:00:00Z'),
          registrationClosesAt: null,
        },
        now,
      ),
    'REGISTRATION_WINDOW_CLOSED',
  );
  throwsCode(
    () =>
      assertRegistrationWindowOpen(
        {
          registrationOpensAt: null,
          registrationClosesAt: new Date('2030-01-01T08:30:00Z'),
        },
        now,
      ),
    'REGISTRATION_WINDOW_CLOSED',
  );
});

/* -------------------------------------------------------------------------- */
/* 3. Time slot rules                                                         */
/* -------------------------------------------------------------------------- */

test('inactive and full time slots reject scheduling; slot stays in campaign', () => {
  assertTimeSlotActive({ isActive: true });
  throwsCode(
    () => assertTimeSlotActive({ isActive: false }),
    'TIME_SLOT_INACTIVE',
  );

  assertTimeSlotHasCapacity(10, 9);
  throwsCode(() => assertTimeSlotHasCapacity(1, 1), 'TIME_SLOT_FULL');
  throwsCode(() => assertTimeSlotHasCapacity(1, 2), 'TIME_SLOT_FULL');

  const campaign = { startsAt: start, endsAt: end };
  throwsCode(
    () =>
      validateTimeSlot(
        {
          campaignId: 'be483e42-de94-4e04-905d-14b08d329767',
          startsAt: new Date(start.getTime() - 1000),
          endsAt: end,
          capacity: 5,
        },
        campaign,
      ),
    'TIME_SLOT_OUTSIDE_CAMPAIGN',
  );
  throwsCode(
    () =>
      validateTimeSlot(
        {
          campaignId: 'be483e42-de94-4e04-905d-14b08d329767',
          startsAt: start,
          endsAt: end,
          capacity: 0,
        },
        campaign,
      ),
    'VALIDATION_ERROR',
  );
});

/* -------------------------------------------------------------------------- */
/* 4. Registration rules                                                      */
/* -------------------------------------------------------------------------- */

test('one registration per campaign reuses a cancelled one', () => {
  assert.deepEqual(assertSingleRegistrationPerCampaign(null), { reuse: false });
  assert.deepEqual(
    assertSingleRegistrationPerCampaign({ id: 'r1', status: 'CANCELLED' }),
    { reuse: true },
  );
  throwsCode(
    () => assertSingleRegistrationPerCampaign({ id: 'r1', status: 'PENDING' }),
    'REGISTRATION_DUPLICATE',
  );
  throwsCode(
    () =>
      assertSingleRegistrationPerCampaign({ id: 'r1', status: 'COMPLETED' }),
    'REGISTRATION_DUPLICATE',
  );
});

test('overlapping donor schedules are rejected, adjacent slots are allowed', () => {
  const existing = [{ startsAt: start, endsAt: end }];
  assertNoScheduleOverlap(existing, {
    startsAt: end,
    endsAt: new Date(end.getTime() + 3600000),
  });
  assertNoScheduleOverlap(existing, {
    startsAt: new Date(start.getTime() - 3600000),
    endsAt: start,
  });
  throwsCode(
    () => assertNoScheduleOverlap(existing, { startsAt: start, endsAt: end }),
    'REGISTRATION_OVERLAP',
  );
  throwsCode(
    () =>
      assertNoScheduleOverlap(existing, {
        startsAt: new Date(start.getTime() + 60000),
        endsAt: new Date(end.getTime() + 60000),
      }),
    'REGISTRATION_OVERLAP',
  );
});

test('scheduling is limited to pre-check-in states and validates its payload', () => {
  assert.deepEqual(resolveScheduleOutcome('PENDING'), {
    mode: 'SCHEDULE',
    status: 'SCHEDULED',
  });
  assert.deepEqual(resolveScheduleOutcome('WAITLISTED'), {
    mode: 'SCHEDULE',
    status: 'SCHEDULED',
  });
  assert.deepEqual(resolveScheduleOutcome('CONFIRMED'), {
    mode: 'RESCHEDULE',
    status: 'CONFIRMED',
  });
  throwsCode(
    () => resolveScheduleOutcome('COMPLETED'),
    'REGISTRATION_INVALID_TRANSITION',
  );
  throwsCode(
    () => resolveScheduleOutcome('NO_SHOW'),
    'REGISTRATION_INVALID_TRANSITION',
  );

  throwsCode(
    () =>
      validateScheduleRegistration({
        registrationId: 'not-a-uuid',
        timeSlotId: 'x',
      }),
    'VALIDATION_ERROR',
  );

  assert.equal(
    validateCreateRegistration({
      campaignId: 'be483e42-de94-4e04-905d-14b08d329767',
    }).campaignId,
    'be483e42-de94-4e04-905d-14b08d329767',
  );
  throwsCode(
    () => validateCreateRegistration({ campaignId: 'nope' }),
    'VALIDATION_ERROR',
  );
});

test('check-in rules allow SCHEDULED/CONFIRMED and block the rest', () => {
  assertCanCheckIn('SCHEDULED');
  assertCanCheckIn('CONFIRMED');
  for (const status of [
    'CANCELLED',
    'NO_SHOW',
    'COMPLETED',
    'WAITLISTED',
    'PENDING',
  ] as const) {
    throwsCode(() => assertCanCheckIn(status), 'CHECK_IN_NOT_ALLOWED');
  }
  throwsCode(
    () => assertCanCheckIn('SCHEDULED', { alreadyCheckedIn: true }),
    'REGISTRATION_ALREADY_CHECKED_IN',
  );
});

/* -------------------------------------------------------------------------- */
/* 5. Screening rules                                                         */
/* -------------------------------------------------------------------------- */

test('screening requires a check-in, a reviewed reason and catalogue test codes', () => {
  throwsCode(() => assertCanScreen(null), 'CHECK_IN_REQUIRED');
  assertCanScreen('check-in-id');

  validateScreeningReview({ status: 'ELIGIBLE' });
  validateScreeningReview({ status: 'INELIGIBLE' });
  throwsCode(
    () => validateScreeningReview({ status: 'DEFERRED' }),
    'SCREENING_REVIEW_REASON_REQUIRED',
  );
  validateScreeningReview({
    status: 'DEFERRED',
    decisionReason: 'Chưa đủ ngày giãn cách',
    deferredUntil: new Date('2030-03-01T00:00:00Z'),
  });

  assert.ok(
    SCREENING_TEST_CATALOG.some((entry) => entry.code === 'HEMOGLOBIN'),
    'HEMOGLOBIN must be a catalogue test code',
  );
  validateScreeningTests([{ code: 'HEMOGLOBIN', numericValue: 13.5 }]);
  throwsCode(
    () => validateScreeningTests([{ code: 'ARBITRARY_CODE' }]),
    'SCREENING_TEST_CODE_INVALID',
  );
  throwsCode(
    () =>
      validateScreeningTests([{ code: 'HEMOGLOBIN' }, { code: 'HEMOGLOBIN' }]),
    'VALIDATION_ERROR',
  );

  validateScreeningMeasurements({
    weightKg: 60,
    temperatureC: 36.7,
    systolicBp: 120,
    diastolicBp: 80,
    pulse: 78,
    hemoglobin: 14.2,
  });
  throwsCode(
    () => validateScreeningMeasurements({ weightKg: -1 }),
    'VALIDATION_ERROR',
  );
  throwsCode(
    () => validateScreeningMeasurements({ systolicBp: 120.5 }),
    'VALIDATION_ERROR',
  );
});

/* -------------------------------------------------------------------------- */
/* 6. Donation, blood bag and certificate rules                               */
/* -------------------------------------------------------------------------- */

test('donation requires check-in and an ELIGIBLE screening', () => {
  throwsCode(
    () =>
      assertCanStartDonation({ checkInId: null, screeningStatus: 'ELIGIBLE' }),
    'CHECK_IN_REQUIRED',
  );
  throwsCode(
    () =>
      assertCanStartDonation({
        checkInId: 'c1',
        screeningStatus: 'INELIGIBLE',
      }),
    'SCREENING_NOT_ELIGIBLE',
  );
  throwsCode(
    () =>
      assertCanStartDonation({ checkInId: 'c1', screeningStatus: 'DEFERRED' }),
    'SCREENING_NOT_ELIGIBLE',
  );
  assertCanStartDonation({ checkInId: 'c1', screeningStatus: 'ELIGIBLE' });

  assertCanDonate('ELIGIBLE');
  throwsCode(() => assertCanDonate('WAITING_REVIEW'), 'SCREENING_NOT_ELIGIBLE');
  // The aggregator delegates to the screening module rule.
  assertScreeningEligibleForDonation('ELIGIBLE');
  throwsCode(
    () => assertScreeningEligibleForDonation('INELIGIBLE'),
    'SCREENING_NOT_ELIGIBLE',
  );
});

test('completing a donation requires timing, volume and a performer', () => {
  const completed = validateDonationCompletion({
    startedAt: start,
    completedAt: end,
    volumeMl: 350,
  });
  assert.equal(completed.volumeMl, 350);
  assert.equal(completed.startedAt, start);

  throwsCode(
    () => validateDonationCompletion({ completedAt: end, volumeMl: 350 }),
    'VALIDATION_ERROR',
  );
  throwsCode(
    () => validateDonationCompletion({ startedAt: start, completedAt: end }),
    'DONATION_VOLUME_INVALID',
  );
  throwsCode(
    () =>
      validateDonation({ startedAt: end, completedAt: start, volumeMl: 350 }),
    'DONATION_TIME_INVALID',
  );
  throwsCode(
    () =>
      validateDonationCompletion({
        startedAt: start,
        completedAt: end,
        volumeMl: 1.5,
      }),
    'VALIDATION_ERROR',
  );
});

test('certificates are issued only for completed donations and revoked once', () => {
  assertCanIssueCertificate('COMPLETED');
  for (const status of ['PENDING', 'IN_PROGRESS', 'STOPPED'] as const) {
    throwsCode(
      () => assertCanIssueCertificate(status),
      'DONATION_NOT_COMPLETED',
    );
    throwsCode(
      () => assertCertificateIssuable(status, null),
      'DONATION_NOT_COMPLETED',
    );
  }
  throwsCode(
    () => assertCertificateIssuable('COMPLETED', { id: 'cert-1' }),
    'CERTIFICATE_NOT_ALLOWED',
  );
  assertCertificateIssuable('COMPLETED', null);
  assertCanRevokeCertificate('ACTIVE');
  throwsCode(
    () => assertCanRevokeCertificate('REVOKED'),
    'CERTIFICATE_ALREADY_REVOKED',
  );
});

test('blood bag volumes must reconcile with the donation volume', () => {
  // One donation to one bag, and one donation to many bags.
  assertBagVolumesReconcile(350, [350]);
  assertBagVolumesReconcile(350, [200, 150]);
  throwsCode(
    () => assertBagVolumesReconcile(350, [200]),
    'DONATION_RECONCILIATION_FAILED',
  );
  throwsCode(
    () => assertBagVolumesReconcile(350, []),
    'DONATION_RECONCILIATION_FAILED',
  );
  throwsCode(
    () => assertBagVolumesReconcile(350, [0]),
    'DONATION_RECONCILIATION_FAILED',
  );
  throwsCode(
    () => assertBagVolumesReconcile(0, [350]),
    'DONATION_VOLUME_INVALID',
  );
});

/* -------------------------------------------------------------------------- */
/* 7. Existing validators stay intact                                         */
/* -------------------------------------------------------------------------- */

test('measurement and volume validators reject invalid numbers', () => {
  for (const volumeMl of [-350, 0, NaN, Infinity, 1.5]) {
    throwsCode(
      () => parseDomain(volumeSchema, { volumeMl }),
      'VALIDATION_ERROR',
    );
  }
  assert.equal(parseDomain(volumeSchema, { volumeMl: 350 }).volumeMl, 350);

  // Synthetic limits test generic numeric validation, not clinical eligibility.
  assertMeasurement(5, 1, 10, true);
  throwsCode(() => assertMeasurement(0, 1, 10), 'MEASUREMENT_INVALID');
  throwsCode(() => assertMeasurement(11, 1, 10), 'MEASUREMENT_INVALID');
  throwsCode(() => assertMeasurement(5.5, 1, 10, true), 'MEASUREMENT_INVALID');
});

/* -------------------------------------------------------------------------- */
/* 8. API conventions                                                         */
/* -------------------------------------------------------------------------- */

test('success, list and failure envelopes follow the Phase 1 convention', () => {
  assert.deepEqual(successResponse({ id: '1' }), {
    success: true,
    data: { id: '1' },
  });

  const list = listResponse([{ id: '1' }], paginationMeta(1, 10, 25));
  assert.equal(list.success, true);
  assert.equal(list.data.length, 1);
  assert.deepEqual(list.meta, { page: 1, limit: 10, total: 25, totalPages: 3 });
  assert.equal(paginationMeta(1, 10, 0).totalPages, 0);

  assert.deepEqual(failureResponse('TIME_SLOT_FULL'), {
    success: false,
    error: {
      code: 'TIME_SLOT_FULL',
      message: 'Khung giờ đã đủ số lượng đăng ký',
      fields: null,
    },
  });

  const validation = failureResponse('VALIDATION_ERROR', undefined, {
    email: 'Email không hợp lệ',
  });
  assert.equal(validation.success, false);
  assert.deepEqual(validation.error.fields, { email: 'Email không hợp lệ' });
});

test('pagination input is clamped to safe bounds', () => {
  assert.deepEqual(
    { page: resolvePagination().page, limit: resolvePagination().limit },
    { page: 1, limit: 10 },
  );
  assert.equal(resolvePagination({ page: 0 }).page, 1);
  assert.equal(resolvePagination({ limit: 1000 }).limit, 100);
  assert.equal(resolvePagination({ limit: 0 }).limit, 1);
  assert.equal(resolvePagination({ page: 3, limit: 20 }).skip, 40);
});

test('zod issues are flattened into field errors', () => {
  const schema = z.object({ email: z.string() });
  const parsed = schema.safeParse({ email: 1 });
  assert.equal(parsed.success, false);
  if (!parsed.success) {
    const fields = zodFields(parsed.error.issues);
    assert.deepEqual(Object.keys(fields), ['email']);
  }
});

/* -------------------------------------------------------------------------- */
/* 9. Auth and audit foundation                                               */
/* -------------------------------------------------------------------------- */

test('passwords and opaque tokens are only ever persisted as hashes', async () => {
  const hash = await hashPassword('S3cret-Password!');
  assert.ok(hash.startsWith('scrypt$'));
  assert.equal(hash.includes('S3cret-Password!'), false);
  assert.equal(await verifyPassword('S3cret-Password!', hash), true);
  assert.equal(await verifyPassword('wrong-password', hash), false);
  assert.equal(
    await verifyPassword('S3cret-Password!', 'not-a-valid-hash'),
    false,
  );
  assert.equal(await verifyPassword('x', 'scrypt$1$2$3$4$5'), false);

  const token = 'refresh-token-value';
  assert.equal(hashOpaqueToken(token), hashOpaqueToken(token));
  assert.notEqual(hashOpaqueToken(token), token);
  assert.notEqual(hashOpaqueToken(token), hashOpaqueToken(`${token}-other`));
});

test('audit action catalogue covers every Phase 1 required action', () => {
  const required = [
    'LOGIN_SUCCESS',
    'LOGIN_FAILED',
    'PASSWORD_CHANGED',
    'USER_CREATED',
    'USER_UPDATED',
    'USER_DEACTIVATED',
    'ROLE_ASSIGNED',
    'ROLE_REMOVED',
    'CAMPAIGN_CREATED',
    'CAMPAIGN_UPDATED',
    'CAMPAIGN_OPENED',
    'CAMPAIGN_CLOSED',
    'CAMPAIGN_CANCELLED',
    'REGISTRATION_CREATED',
    'REGISTRATION_RESCHEDULED',
    'REGISTRATION_CANCELLED',
    'REGISTRATION_CHECKED_IN',
    'REGISTRATION_NO_SHOW',
    'SCREENING_UPDATED',
    'SCREENING_REVIEWED',
    'DONATION_STARTED',
    'DONATION_COMPLETED',
    'DONATION_STOPPED',
    'BLOOD_BAG_CREATED',
    'BLOOD_BAG_STATUS_CHANGED',
    'CERTIFICATE_ISSUED',
    'CERTIFICATE_REVOKED',
  ];
  for (const action of required) {
    assert.ok(
      action in AUDIT_ACTIONS,
      `audit action ${action} is missing from the catalogue`,
    );
  }
});

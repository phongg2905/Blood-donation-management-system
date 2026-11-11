import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  ERROR_CODES,
} from '@blood/shared-types';
import { AppError } from '../../common/errors/app.error';
import { parseDomain } from '../../common/helpers/domain-validation';
import type { AuditContext } from '../audit-logs/audit.service';
import { auditLogService } from '../audit-logs/audit.service';
import {
  assertCampaignAcceptsRegistration,
  assertCampaignEditable,
  assertRegistrationWindowOpen,
} from '../donation-campaigns/campaign.validation';
import {
  assertNoScheduleOverlap,
  resolveScheduleOutcome,
  validateScheduleRegistration,
} from '../registrations/registration.validation';
import { timeSlotRepository as repository } from './time-slot.repository';
import {
  assertTimeSlotActive,
  assertTimeSlotHasCapacity,
  timeSlotSchema,
  validateTimeSlot,
  validateTimeSlotPatch,
} from './time-slot.validation';

export interface ScheduleContext {
  actorId?: string | null;
}

// `create`/`schedule` below stay internal-only (called from registration
// flow); `list`/`getById`/`update`/`deactivate` back the new HTTP CRUD.
export const timeSlotService = {
  async create(input: unknown) {
    const data = parseDomain(timeSlotSchema, input);
    return repository.transaction(async (tx) => {
      const campaign = await repository.campaign(tx, data.campaignId);
      if (!campaign) throw AppError.notFound(ERROR_CODES.CAMPAIGN_NOT_FOUND);
      assertCampaignEditable(campaign.status);

      const validated = validateTimeSlot(data, campaign);
      const duplicate = await repository.duplicateWindowTx(
        tx,
        data.campaignId,
        validated.startsAt,
        validated.endsAt,
      );
      if (duplicate) {
        throw AppError.conflict(
          ERROR_CODES.VALIDATION_ERROR,
          'Khung giờ này đã tồn tại trong đợt hiến máu',
        );
      }

      return repository.create(tx, validated);
    });
  },

  /**
   * Schedules or reschedules a registration into a time slot.
   *
   * Enforced here (not only in the frontend): campaign accepts registrations,
   * registration window, slot isActive, slot belongs to the campaign, capacity,
   * donor schedule overlap, 84-day physiological interval, active deferral
   * check, and the registration state transition.
   */
  async schedule(input: unknown, context: ScheduleContext = {}) {
    const data = validateScheduleRegistration(input);
    return repository.transaction(async (tx) => {
      const registration = await repository.registration(
        tx,
        data.registrationId,
      );
      if (!registration)
        throw AppError.notFound(ERROR_CODES.REGISTRATION_NOT_FOUND);
      const slot = await repository.slot(tx, data.timeSlotId);
      if (!slot) throw AppError.notFound(ERROR_CODES.TIME_SLOT_NOT_FOUND);

      if (registration.campaignId !== slot.campaignId) {
        throw AppError.badRequest(
          ERROR_CODES.TIME_SLOT_OUTSIDE_CAMPAIGN,
          'Khung giờ thuộc đợt hiến máu khác',
        );
      }
      if (registration.checkIn) {
        throw AppError.conflict(ERROR_CODES.REGISTRATION_ALREADY_CHECKED_IN);
      }

      // Rejects checked-in/terminal registrations before touching capacity.
      const outcome = resolveScheduleOutcome(registration.status);

      // Mandatory: a deactivated slot is never schedulable or reschedulable.
      assertTimeSlotActive(slot);
      assertCampaignAcceptsRegistration(slot.campaign.status);
      assertRegistrationWindowOpen(slot.campaign);

      const now = new Date();
      if (now >= slot.startsAt) {
        throw AppError.conflict(
          ERROR_CODES.REGISTRATION_WINDOW_CLOSED,
          'Khung giờ đã bắt đầu',
        );
      }

      // Defends against campaign dates edited after the slot was created.
      validateTimeSlot(slot, slot.campaign);

      // Medical deferral check: block if donor is deferred beyond slot start
      const activeDeferral = await repository.activeDeferralTx(
        tx,
        registration.donorId,
        slot.startsAt,
      );
      if (activeDeferral) {
        throw AppError.conflict(
          ERROR_CODES.SCREENING_NOT_ELIGIBLE,
          'Bạn đang trong thời gian tạm hoãn hiến máu theo chỉ định y tế',
        );
      }

      // 84-day physiological recovery check after whole-blood donation (TT 26/2013/TT-BYT)
      const recentDonation = await repository.recentCompletedDonationTx(
        tx,
        registration.donorId,
        slot.startsAt,
      );
      if (recentDonation) {
        throw AppError.conflict(
          ERROR_CODES.REGISTRATION_OVERLAP,
          'Khoảng cách tối thiểu giữa 2 lần hiến máu toàn phần là 84 ngày (12 tuần)',
        );
      }

      // Prevent holding multiple active registrations within 84 days
      const activeOtherRegistration =
        await repository.activeRegistrationsWithinIntervalTx(
          tx,
          registration.donorId,
          registration.id,
          slot.startsAt,
        );
      if (activeOtherRegistration) {
        throw AppError.conflict(
          ERROR_CODES.REGISTRATION_OVERLAP,
          `Bạn đã có lịch đăng ký đang hoạt động tại "${activeOtherRegistration.campaign.name}" trong vòng 84 ngày`,
        );
      }

      const occupied = await repository.occupied(tx, slot.id, registration.id);
      assertTimeSlotHasCapacity(slot.capacity, occupied);

      const overlaps = await repository.overlappingSchedules(
        tx,
        registration.donorId,
        registration.id,
        slot.startsAt,
        slot.endsAt,
      );
      assertNoScheduleOverlap(
        overlaps.flatMap((row) => (row.timeSlot ? [row.timeSlot] : [])),
        { startsAt: slot.startsAt, endsAt: slot.endsAt },
      );

      const updated = await repository.schedule(
        tx,
        registration.id,
        slot.id,
        outcome.status,
      );

      await auditLogService.record(
        {
          action:
            outcome.mode === 'SCHEDULE'
              ? AUDIT_ACTIONS.REGISTRATION_CREATED
              : AUDIT_ACTIONS.REGISTRATION_RESCHEDULED,
          entityType: AUDIT_ENTITY_TYPES.REGISTRATION,
          entityId: registration.id,
          actorId: context.actorId ?? null,
          metadata: {
            timeSlotId: slot.id,
            previousTimeSlotId: registration.timeSlotId,
            previousStatus: registration.status,
            status: outcome.status,
          },
        },
        tx,
      );

      return updated;
    });
  },

  async list(campaignId: string, activeOnly: boolean) {
    const slots = await repository.listByCampaign(campaignId, activeOnly);
    return slots.map((s) => ({
      ...s,
      occupied: (s as any)._count?.registrations ?? 0,
    }));
  },

  async getById(id: string) {
    const slot = await repository.findById(id);
    if (!slot) throw AppError.notFound(ERROR_CODES.TIME_SLOT_NOT_FOUND);
    return slot;
  },

  /** Merge-then-validate like campaign.update — see validateTimeSlotPatch. */
  async update(id: string, input: unknown, ctx: AuditContext) {
    const patch = validateTimeSlotPatch(input);
    return repository.transaction(async (tx) => {
      const existing = await repository.slot(tx, id);
      if (!existing) throw AppError.notFound(ERROR_CODES.TIME_SLOT_NOT_FOUND);
      const campaign = await repository.campaign(tx, existing.campaignId);
      if (!campaign) throw AppError.notFound(ERROR_CODES.CAMPAIGN_NOT_FOUND);
      assertCampaignEditable(campaign.status);

      const merged = { ...existing, ...patch };
      const data = validateTimeSlot(merged, campaign);

      const duplicate = await repository.duplicateWindowTx(
        tx,
        existing.campaignId,
        data.startsAt,
        data.endsAt,
        id,
      );
      if (duplicate) {
        throw AppError.conflict(
          ERROR_CODES.VALIDATION_ERROR,
          'Khung giờ này đã tồn tại trong đợt hiến máu',
        );
      }

      const currentOccupied = await repository.occupied(tx, id, '');
      if (data.capacity < currentOccupied) {
        throw AppError.conflict(
          ERROR_CODES.TIME_SLOT_FULL,
          `Không thể giảm sức chứa xuống thấp hơn số người đã đăng ký (${currentOccupied})`,
        );
      }

      const updated = await repository.update(tx, id, data);
      await auditLogService.record(
        {
          ...ctx,
          action: AUDIT_ACTIONS.TIME_SLOT_UPDATED,
          entityType: AUDIT_ENTITY_TYPES.TIME_SLOT,
          entityId: id,
          metadata: { fields: Object.keys(patch) },
        },
        tx,
      );
      return updated;
    });
  },

  async deactivate(id: string, ctx: AuditContext) {
    return repository.transaction(async (tx) => {
      const existing = await repository.slot(tx, id);
      if (!existing) throw AppError.notFound(ERROR_CODES.TIME_SLOT_NOT_FOUND);
      assertCampaignEditable(existing.campaign.status);

      const updated = await repository.update(tx, id, { isActive: false });
      await auditLogService.record(
        {
          ...ctx,
          action: AUDIT_ACTIONS.TIME_SLOT_DEACTIVATED,
          entityType: AUDIT_ENTITY_TYPES.TIME_SLOT,
          entityId: id,
        },
        tx,
      );
      return updated;
    });
  },
};

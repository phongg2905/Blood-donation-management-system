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
      return repository.create(tx, validateTimeSlot(data, campaign));
    });
  },

  /**
   * Schedules or reschedules a registration into a time slot.
   *
   * Enforced here (not only in the frontend): campaign accepts registrations,
   * registration window, slot isActive, slot belongs to the campaign, capacity,
   * donor schedule overlap and the registration state transition.
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
    return repository.listByCampaign(campaignId, activeOnly);
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

      const merged = { ...existing, ...patch };
      const data = validateTimeSlot(merged, campaign);
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

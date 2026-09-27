import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  ERROR_CODES,
} from '@blood/shared-types';
import { AppError } from '../../common/errors/app.error';
import { parseDomain } from '../../common/helpers/domain-validation';
import type { AuditContext } from '../audit-logs/audit.service';
import { auditLogService } from '../audit-logs/audit.service';
import { timeSlotService } from '../time-slots/time-slot.service';
import { registrationRepository as repo } from './registration.repository';
import {
  assertRegistrationTransition,
  assertSingleRegistrationPerCampaign,
  createRegistrationSchema,
} from './registration.validation';

const healthDeclarationSchema = z.object({
  answers: z.record(z.string(), z.unknown()),
  questionnaireVersion: z.string().trim().max(50).optional(),
});

/** Merged step per the new flow: one call creates the registration and its declaration together. */
const createWithDeclarationSchema = createRegistrationSchema.extend({
  healthDeclaration: healthDeclarationSchema,
});

export const registrationService = {
  async create(userId: string, input: unknown, ctx: AuditContext) {
    const data = parseDomain(createWithDeclarationSchema, input);

    const registration = await repo.transaction(async (tx) => {
      const donor = await repo.donorProfileByUserId(tx, userId);
      if (!donor)
        throw AppError.internal('DonorProfile missing for a DONOR account');

      const existing = await repo.findByDonorAndCampaign(
        tx,
        donor.id,
        data.campaignId,
      );
      const { reuse } = assertSingleRegistrationPerCampaign(existing);

      const row = reuse
        ? await repo.reuse(tx, existing!.id, {
            status: 'PENDING',
            cancelReason: null,
            timeSlotId: data.timeSlotId ?? null,
          })
        : await repo.create(tx, {
            donorId: donor.id,
            campaignId: data.campaignId,
          });

      await repo.createHealthDeclaration(tx, {
        registrationId: row.id,
        answers: data.healthDeclaration.answers as Prisma.InputJsonValue,
        questionnaireVersion: data.healthDeclaration.questionnaireVersion,
        submittedAt: new Date(),
      });

      await auditLogService.record(
        {
          ...ctx,
          action: AUDIT_ACTIONS.REGISTRATION_CREATED,
          entityType: AUDIT_ENTITY_TYPES.REGISTRATION,
          entityId: row.id,
        },
        tx,
      );
      return row;
    });

    // Scheduling is a separate, already-atomic operation (capacity/overlap
    // enforced with Serializable+retry) — not folded into the tx above.
    if (data.timeSlotId) {
      return timeSlotService.schedule(
        { registrationId: registration.id, timeSlotId: data.timeSlotId },
        ctx,
      );
    }
    return registration;
  },

  async getById(id: string) {
    const registration = await repo.findById(id);
    if (!registration)
      throw AppError.notFound(ERROR_CODES.REGISTRATION_NOT_FOUND);
    return registration;
  },

  reschedule: (registrationId: string, timeSlotId: string, ctx: AuditContext) =>
    timeSlotService.schedule({ registrationId, timeSlotId }, ctx),

  async cancel(id: string, reason: string | undefined, ctx: AuditContext) {
    return repo.transaction(async (tx) => {
      const existing = await repo.findByIdTx(tx, id);
      if (!existing)
        throw AppError.notFound(ERROR_CODES.REGISTRATION_NOT_FOUND);
      assertRegistrationTransition(existing.status, 'CANCELLED');

      const updated = await repo.update(tx, id, {
        status: 'CANCELLED',
        cancelReason: reason ?? null,
      });
      await auditLogService.record(
        {
          ...ctx,
          action: AUDIT_ACTIONS.REGISTRATION_CANCELLED,
          entityType: AUDIT_ENTITY_TYPES.REGISTRATION,
          entityId: id,
        },
        tx,
      );
      return updated;
    });
  },
};

import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  ERROR_CODES,
} from '@blood/shared-types';
import { AppError } from '../../common/errors/app.error';
import { parseDomain } from '../../common/helpers/domain-validation';
import {
  paginationMeta,
  resolvePagination,
} from '../../common/helpers/response';
import { database } from '../../config/database';
import type { AuditContext } from '../audit-logs/audit.service';
import { auditLogService } from '../audit-logs/audit.service';
import { notificationService } from '../notifications/notification.service';
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
            timeSlotId: null,
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

      if (!data.timeSlotId) {
        await auditLogService.record(
          {
            ...ctx,
            action: AUDIT_ACTIONS.REGISTRATION_CREATED,
            entityType: AUDIT_ENTITY_TYPES.REGISTRATION,
            entityId: row.id,
          },
          tx,
        );
      }

      return { row, reuse, previous: existing };
    });

    let finalRow = registration.row;
    if (data.timeSlotId) {
      try {
        finalRow = await timeSlotService.schedule(
          { registrationId: registration.row.id, timeSlotId: data.timeSlotId },
          ctx,
        );
      } catch (error) {
        await repo.transaction(async (tx) => {
          if (registration.reuse && registration.previous) {
            await repo.reuse(tx, registration.previous.id, {
              status: registration.previous.status,
              cancelReason: registration.previous.cancelReason,
              timeSlotId: registration.previous.timeSlotId,
            });
          } else {
            await repo.deleteCreated(tx, registration.row.id);
          }
        });
        throw error;
      }
    }

    const notification = await repo.transaction((tx) =>
      notificationService.create(tx, {
        userId,
        type: 'REGISTRATION',
        title: 'Xác nhận đăng ký hiến máu',
        message: `Đăng ký của bạn cho đợt hiến máu đã được ghi nhận (mã ${finalRow.id}).`,
        channel: 'EMAIL',
      }),
    );
    void notificationService.dispatch(notification);

    return finalRow;
  },

  /** Staff-only directory search by CCCD/phone/name/email — DONOR uses `my()` instead. */
  async search(query: unknown) {
    const schema = z.object({
      search: z.string().trim().min(1).max(100).optional(),
      status: z.string().trim().optional(),
      campaignId: z.string().uuid().optional(),
      page: z.coerce.number().int().positive().optional(),
      limit: z.coerce.number().int().positive().optional(),
    });
    const filters = parseDomain(schema, query);
    const pagination = resolvePagination(filters);
    const { items, total } = await repo.search({
      search: filters.search,
      status: filters.status,
      campaignId: filters.campaignId,
      skip: pagination.skip,
      take: pagination.take,
    });
    return {
      items,
      meta: paginationMeta(pagination.page, pagination.limit, total),
    };
  },

  async my(userId: string, query: unknown) {
    const schema = z.object({
      page: z.coerce.number().int().positive().optional(),
      limit: z.coerce.number().int().positive().optional(),
    });
    const filters = parseDomain(schema, query);
    const pagination = resolvePagination(filters);
    const donor = await database.donorProfile.findUnique({ where: { userId } });
    if (!donor)
      throw AppError.internal('DonorProfile missing for a DONOR account');
    const { items, total } = await repo.listByDonor(
      donor.id,
      pagination.skip,
      pagination.take,
    );
    return {
      items,
      meta: paginationMeta(pagination.page, pagination.limit, total),
    };
  },

  async getById(
    id: string,
    auth: { userId: string; roles: readonly string[] },
  ) {
    const registration = await repo.findById(id);
    if (!registration)
      throw AppError.notFound(ERROR_CODES.REGISTRATION_NOT_FOUND);
    // DONOR may only read their own; DONATION_STAFF/COORDINATOR/SYSTEM_ADMIN
    // hold `registration.read` for operational/oversight reasons and aren't scoped.
    const staffLike = auth.roles.some((r) => r !== 'DONOR');
    if (!staffLike && registration.donor.userId !== auth.userId) {
      throw AppError.forbidden();
    }
    return registration;
  },

  reschedule: (registrationId: string, timeSlotId: string, ctx: AuditContext) =>
    timeSlotService.schedule({ registrationId, timeSlotId }, ctx),

  async cancel(
    id: string,
    reason: string | undefined,
    ctx: AuditContext,
    auth?: { userId: string; roles: readonly string[] },
  ) {
    return repo.transaction(async (tx) => {
      const existing = await repo.findByIdTx(tx, id);
      if (!existing)
        throw AppError.notFound(ERROR_CODES.REGISTRATION_NOT_FOUND);

      if (auth) {
        const staffLike = auth.roles.some((r) => r !== 'DONOR');
        if (!staffLike && existing.donor?.userId !== auth.userId) {
          throw AppError.forbidden();
        }
      }

      if (existing.checkIn) {
        throw AppError.conflict(
          ERROR_CODES.REGISTRATION_INVALID_TRANSITION,
          'Không thể hủy lịch hẹn đã được tiếp nhận/điểm danh.',
        );
      }

      const appointmentEnd = existing.timeSlot?.endsAt ?? existing.campaign?.endsAt;
      if (appointmentEnd && appointmentEnd < new Date()) {
        throw AppError.conflict(
          ERROR_CODES.REGISTRATION_INVALID_TRANSITION,
          'Không thể hủy lịch hẹn đã qua thời gian diễn ra.',
        );
      }

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

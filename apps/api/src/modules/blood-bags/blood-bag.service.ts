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
import type { AuditContext } from '../audit-logs/audit.service';
import { auditLogService } from '../audit-logs/audit.service';
import { database } from '../../config/database';
import { notificationService } from '../notifications/notification.service';
import { assertScreeningEligibleForDonation } from '../screenings/screening.validation';
import { assertBagVolumesReconcile } from './blood-bag.validation';
import { bloodBagRepository as repo } from './blood-bag.repository';

const bagSchema = z.object({
  code: z.string().trim().min(1).max(64),
  volumeMl: z.number().int().positive(),
  bloodType: z
    .enum([
      'A_POSITIVE',
      'A_NEGATIVE',
      'B_POSITIVE',
      'B_NEGATIVE',
      'AB_POSITIVE',
      'AB_NEGATIVE',
      'O_POSITIVE',
      'O_NEGATIVE',
    ])
    .nullish(),
});
const recordSchema = z.object({ bags: z.array(bagSchema).min(1).max(20) });

const listQuerySchema = z.object({
  campaignId: z.string().uuid().optional(),
  status: z.string().trim().optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

const updateBagSchema = z.object({
  volumeMl: z.number().int().positive().optional(),
  status: z
    .enum([
      'CREATED',
      'COLLECTED',
      'PENDING_TEST',
      'TESTED',
      'ACCEPTED',
      'REJECTED',
      'DISCARDED',
    ])
    .optional(),
  bloodType: z
    .enum([
      'A_POSITIVE',
      'A_NEGATIVE',
      'B_POSITIVE',
      'B_NEGATIVE',
      'AB_POSITIVE',
      'AB_NEGATIVE',
      'O_POSITIVE',
      'O_NEGATIVE',
    ])
    .nullish(),
  storageLocation: z.string().trim().max(100).optional(),
  syncDonorProfile: z.boolean().optional(),
});

export const bloodBagService = {
  /**
   * Choice B: the "lấy máu" step is not exposed — Donation is created and
   * marked COMPLETED silently in the same call that records barcodes, so the
   * schema's three-timestamp design stays intact without a separate HTTP flow.
   */
  async recordCollection(
    screeningId: string,
    input: unknown,
    staffUserId: string,
    ctx: AuditContext,
  ) {
    const { bags } = parseDomain(recordSchema, input);
    const totalVolumeMl = bags.reduce((sum, b) => sum + b.volumeMl, 0);
    assertBagVolumesReconcile(
      totalVolumeMl,
      bags.map((b) => b.volumeMl),
    );

    const result = await repo.transaction(async (tx) => {
      const screening = await repo.findScreeningTx(tx, screeningId);
      if (!screening) throw AppError.notFound(ERROR_CODES.SCREENING_NOT_FOUND);
      assertScreeningEligibleForDonation(screening.status);
      if (screening.donation) {
        throw AppError.conflict(
          ERROR_CODES.CERTIFICATE_NOT_ALLOWED,
          'Lượt hiến máu này đã ghi nhận túi máu/chứng nhận',
        );
      }

      const now = new Date();
      const donation = await repo.createDonation(tx, {
        screeningId,
        status: 'COMPLETED',
        performedById: staffUserId,
        startedAt: now,
        completedAt: now,
        donatedAt: now,
        volumeMl: totalVolumeMl,
      });

      const bloodBags = await repo.createBags(
        tx,
        bags.map((b) => ({ ...b, donationId: donation.id })),
      );

      await auditLogService.record(
        {
          ...ctx,
          action: AUDIT_ACTIONS.DONATION_COMPLETED,
          entityType: AUDIT_ENTITY_TYPES.DONATION,
          entityId: donation.id,
          metadata: { auto: true, bagCount: bloodBags.length },
        },
        tx,
      );

      const notification = await notificationService.create(tx, {
        userId: screening.checkIn.registration.donor.userId,
        type: 'DONATION',
        title: 'Hoàn tất hiến máu thành công',
        message: `Cảm ơn bạn đã tham gia hiến máu nhân đạo (${totalVolumeMl} ml)! Vui lòng nhận Giấy chứng nhận bản giấy tại bàn tiếp đón.`,
        channel: 'EMAIL',
      });

      // Donation stays out of the response — hidden per choice B.
      return { bloodBags, notification };
    });
    void notificationService.dispatch(result.notification);
    return { bloodBags: result.bloodBags, certificate: null };
  },

  async list(query: unknown) {
    const filters = parseDomain(listQuerySchema, query);
    const pagination = resolvePagination(filters);
    const { items, total } = await repo.list({
      campaignId: filters.campaignId,
      status: filters.status,
      search: filters.search,
      skip: pagination.skip,
      take: pagination.take,
    });
    return {
      items,
      meta: paginationMeta(pagination.page, pagination.limit, total),
    };
  },

  async eligibleQueue(campaignId?: string) {
    return repo.listEligibleScreenings(campaignId);
  },

  async getById(id: string) {
    const bag = await repo.findById(id);
    if (!bag) throw AppError.notFound(ERROR_CODES.SCREENING_NOT_FOUND, 'Không tìm thấy túi máu');
    return bag;
  },

  async update(id: string, input: unknown, ctx: AuditContext) {
    const data = parseDomain(updateBagSchema, input);
    const existing = await repo.findById(id);
    if (!existing) throw AppError.notFound(ERROR_CODES.SCREENING_NOT_FOUND, 'Không tìm thấy túi máu');

    const { syncDonorProfile = true, ...bagData } = data;
    let notificationToDispatch: any = null;

    const updated = await repo.transaction(async (tx) => {
      const updatedBag = await tx.bloodBag.update({
        where: { id },
        data: bagData,
      });

      if (data.bloodType && syncDonorProfile) {
        const donorId = existing.donation?.screening?.checkIn?.registration?.donor?.id;
        const donorUserId = existing.donation?.screening?.checkIn?.registration?.donor?.userId;
        const campaignName = existing.donation?.screening?.checkIn?.registration?.campaign?.name ?? 'Đợt hiến máu';

        if (donorId) {
          await tx.donorProfile.update({
            where: { id: donorId },
            data: { bloodType: data.bloodType },
          });
        }

        if (donorUserId) {
          const formatted = data.bloodType.replace('_POSITIVE', ' (Rh+)').replace('_NEGATIVE', ' (Rh−)');
          notificationToDispatch = await notificationService.create(tx, {
            userId: donorUserId,
            type: 'DONATION',
            title: 'Kết quả xét nghiệm nhóm máu',
            message: `Kết quả xét nghiệm máu từ đợt hiến "${campaignName}": Nhóm máu khẳng định của bạn là Nhóm ${formatted}. Túi máu ${existing.code} đạt tiêu chuẩn an toàn truyền máu. Cảm ơn bạn!`,
            channel: 'IN_APP',
          });
        }
      }

      return updatedBag;
    });

    if (notificationToDispatch) {
      void notificationService.dispatch(notificationToDispatch);
    }

    await auditLogService.recordSafely(
      {
        ...ctx,
        action: AUDIT_ACTIONS.DONATION_COMPLETED,
        entityType: AUDIT_ENTITY_TYPES.BLOOD_BAG,
        entityId: id,
        metadata: { updatedFields: Object.keys(data) },
      },
      database,
    );
    return updated;
  },

  async delete(id: string, ctx: AuditContext) {
    const existing = await repo.findById(id);
    if (!existing) throw AppError.notFound(ERROR_CODES.SCREENING_NOT_FOUND, 'Không tìm thấy túi máu');

    await repo.delete(id);
    await auditLogService.recordSafely(
      {
        ...ctx,
        action: AUDIT_ACTIONS.DONATION_COMPLETED,
        entityType: AUDIT_ENTITY_TYPES.BLOOD_BAG,
        entityId: id,
        metadata: { deleted: true, code: existing.code },
      },
      database,
    );
    return { success: true };
  },
};

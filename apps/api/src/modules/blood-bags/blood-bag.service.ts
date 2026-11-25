import { BloodBagStatus } from '@prisma/client';
import { z } from 'zod';
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  ERROR_CODES,
} from '@blood/shared-types';
import { AppError } from '../../common/errors/app.error';
import {
  parseDomain,
  positiveInteger,
} from '../../common/helpers/domain-validation';
import {
  paginationMeta,
  resolvePagination,
} from '../../common/helpers/response';
import type { AuditContext } from '../audit-logs/audit.service';
import { auditLogService } from '../audit-logs/audit.service';
import { notificationService } from '../notifications/notification.service';
import { assertScreeningEligibleForDonation } from '../screenings/screening.validation';
import {
  assertBagVolumesReconcile,
  assertBloodBagTransition,
} from './blood-bag.validation';
import { bloodBagRepository as repo } from './blood-bag.repository';

const bagSchema = z.object({
  code: z.string().trim().min(1).max(64),
  volumeMl: positiveInteger,
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
  status: z.enum(BloodBagStatus).optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

const updateBagSchema = z.object({
  volumeMl: positiveInteger.optional(),
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
    const parsed = parseDomain(recordSchema, input);
    const bags = parsed.bags.map((bag) => ({
      ...bag,
      code: bag.code.toUpperCase(),
    }));
    const normalizedCodes = bags.map((b) => b.code.trim().toUpperCase());
    if (new Set(normalizedCodes).size !== normalizedCodes.length) {
      throw AppError.conflict(
        ERROR_CODES.VALIDATION_ERROR,
        'Không được gán trùng mã barcode túi máu trong cùng một lượt thu nhận',
      );
    }
    const totalVolumeMl = parseDomain(
      positiveInteger,
      bags.reduce((sum, b) => sum + b.volumeMl, 0),
    );
    assertBagVolumesReconcile(
      totalVolumeMl,
      bags.map((b) => b.volumeMl),
    );

    const result = await repo.transaction(async (tx) => {
      const screening = await repo.findScreeningTx(tx, screeningId);
      if (!screening) throw AppError.notFound(ERROR_CODES.SCREENING_NOT_FOUND);
      if (screening.checkIn.registration.donor.userId === staffUserId) {
        throw AppError.forbidden(
          ERROR_CODES.FORBIDDEN,
          'Nhân viên lấy máu không được phép tự thu nhận túi máu của chính mình',
        );
      }
      const staffAssignment = await tx.campaignStaff.findUnique({
        where: {
          campaignId_userId: {
            campaignId: screening.checkIn.registration.campaignId,
            userId: staffUserId,
          },
        },
      });
      if (!staffAssignment) {
        throw AppError.forbidden(
          ERROR_CODES.FORBIDDEN,
          'Bạn chưa được điều phối viên phân công làm việc tại đợt hiến máu này',
        );
      }
      if (staffAssignment.assignment !== 'COLLECTION') {
        throw AppError.forbidden(
          ERROR_CODES.FORBIDDEN,
          'Bạn được phân công vị trí khác trong đợt hiến này, không thể thực hiện Thu nhận túi máu',
        );
      }
      assertScreeningEligibleForDonation(screening.status);
      if (screening.donation) {
        throw AppError.conflict(
          ERROR_CODES.CERTIFICATE_NOT_ALLOWED,
          'Lượt hiến máu này đã ghi nhận túi máu/chứng nhận',
        );
      }

      const duplicateBag = await tx.bloodBag.findFirst({
        where: {
          OR: bags.map((b) => ({
            code: { equals: b.code, mode: 'insensitive' },
          })),
        },
        select: { code: true },
      });
      if (duplicateBag) {
        throw AppError.conflict(
          ERROR_CODES.VALIDATION_ERROR,
          `Mã barcode túi máu "${duplicateBag.code}" đã tồn tại trên hệ thống`,
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
        bags.map((b) => ({
          ...b,
          donationId: donation.id,
          status: 'COLLECTED',
          collectedAt: now,
        })),
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

      await tx.registration.update({
        where: { id: screening.checkIn.registration.id },
        data: { status: 'COMPLETED' },
      });

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
    const query = parseDomain(
      z.object({ campaignId: z.string().uuid().optional() }),
      { campaignId },
    );
    return repo.listEligibleScreenings(query.campaignId);
  },

  async getById(id: string) {
    const bag = await repo.findById(id);
    if (!bag)
      throw AppError.notFound(
        ERROR_CODES.SCREENING_NOT_FOUND,
        'Không tìm thấy túi máu',
      );
    return bag;
  },

  async update(id: string, input: unknown, ctx: AuditContext) {
    const data = parseDomain(updateBagSchema, input);
    const { syncDonorProfile = true, ...bagData } = data;
    const result = await repo.transaction(async (tx) => {
      const existing = await repo.findById(id, tx);
      if (!existing)
        throw AppError.notFound(
          ERROR_CODES.SCREENING_NOT_FOUND,
          'Không tìm thấy túi máu',
        );
      if (data.status && data.status !== existing.status) {
        assertBloodBagTransition(existing.status, data.status);
      }
      const effectiveStatus = data.status ?? existing.status;
      if (
        (effectiveStatus === 'TESTED' || effectiveStatus === 'ACCEPTED') &&
        !(data.bloodType === undefined ? existing.bloodType : data.bloodType)
      ) {
        throw AppError.validation({
          bloodType: 'Cần xác nhận nhóm máu khi hoàn tất xét nghiệm',
        });
      }
      const updatedBag = await tx.bloodBag.update({
        where: { id },
        data: bagData,
      });
      if (data.volumeMl !== undefined && data.volumeMl !== existing.volumeMl) {
        const total = await tx.bloodBag.aggregate({
          where: { donationId: existing.donationId },
          _sum: { volumeMl: true },
        });
        await tx.donation.update({
          where: { id: existing.donationId },
          data: { volumeMl: total._sum.volumeMl },
        });
      }
      let notification = null;
      if (
        data.bloodType &&
        data.bloodType !== existing.bloodType &&
        syncDonorProfile
      ) {
        const registration = existing.donation.screening.checkIn.registration;
        await tx.donorProfile.update({
          where: { id: registration.donor.id },
          data: { bloodType: data.bloodType },
        });
        const formatted = data.bloodType
          .replace('_POSITIVE', ' (Rh+)')
          .replace('_NEGATIVE', ' (Rh−)');
        notification = await notificationService.create(tx, {
          userId: registration.donor.userId,
          type: 'DONATION',
          title: 'Kết quả xét nghiệm nhóm máu',
          message: `Kết quả xác định nhóm máu từ đợt hiến "${registration.campaign.name}": Nhóm ${formatted}.`,
          channel: 'IN_APP',
        });
      }
      await auditLogService.record(
        {
          ...ctx,
          action: AUDIT_ACTIONS.BLOOD_BAG_STATUS_CHANGED,
          entityType: AUDIT_ENTITY_TYPES.BLOOD_BAG,
          entityId: id,
          metadata: { updatedFields: Object.keys(data) },
        },
        tx,
      );
      return { updatedBag, notification };
    });
    if (result.notification)
      void notificationService.dispatch(result.notification);
    return result.updatedBag;
  },

  async delete(id: string, ctx: AuditContext) {
    return repo.transaction(async (tx) => {
      const existing = await repo.findById(id, tx);
      if (!existing)
        throw AppError.notFound(
          ERROR_CODES.SCREENING_NOT_FOUND,
          'Không tìm thấy túi máu',
        );
      const bagCount = await tx.bloodBag.count({
        where: { donationId: existing.donationId },
      });
      if (bagCount <= 1) {
        throw AppError.conflict(
          ERROR_CODES.DONATION_RECONCILIATION_FAILED,
          'Không thể xóa túi máu cuối cùng của lượt hiến đã hoàn tất',
        );
      }
      await tx.bloodBag.delete({ where: { id } });
      const total = await tx.bloodBag.aggregate({
        where: { donationId: existing.donationId },
        _sum: { volumeMl: true },
      });
      await tx.donation.update({
        where: { id: existing.donationId },
        data: { volumeMl: total._sum.volumeMl },
      });
      await auditLogService.record(
        {
          ...ctx,
          action: AUDIT_ACTIONS.BLOOD_BAG_STATUS_CHANGED,
          entityType: AUDIT_ENTITY_TYPES.BLOOD_BAG,
          entityId: id,
          metadata: { deleted: true, code: existing.code },
        },
        tx,
      );
      return { success: true };
    });
  },
};

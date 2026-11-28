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
import { assertBagVolumesReconcile, assertBloodBagTransition } from './blood-bag.validation';
import { bloodBagRepository as repo } from './blood-bag.repository';

const bagSchema = z.object({
  code: z.string().trim().min(1).max(64),
  volumeMl: z.number().int().positive(),
  // A collected bag has no confirmed Lab blood group yet.
  bloodType: z.null().optional(),
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
  confirmBloodTypeResult: z.boolean().optional(),
  confirmBloodTypeOverride: z.boolean().optional(),
  bloodTypeOverrideReason: z.string().trim().max(500).optional(),
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
    const normalizedCodes = bags.map((b) => b.code.trim().toUpperCase());
    if (new Set(normalizedCodes).size !== normalizedCodes.length) {
      throw AppError.conflict(
        ERROR_CODES.VALIDATION_ERROR,
        'Không được gán trùng mã barcode túi máu trong cùng một lượt thu nhận',
      );
    }
    const totalVolumeMl = bags.reduce((sum, b) => sum + b.volumeMl, 0);
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
        where: { code: { in: bags.map((b) => b.code) } },
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
          code: b.code,
          volumeMl: b.volumeMl,
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
    return repo.listEligibleScreenings(campaignId);
  },

  async getById(id: string) {
    const bag = await repo.findById(id);
    if (!bag) throw AppError.notFound(ERROR_CODES.SCREENING_NOT_FOUND, 'Không tìm thấy túi máu');
    return bag;
  },

  async update(id: string, input: unknown, ctx: AuditContext) {
    const data = parseDomain(updateBagSchema, input);
    let notificationToDispatch: any = null;

    const updated = await repo.transaction(async (tx) => {
      const existing = await repo.findByIdTx(tx, id);
      if (!existing) throw AppError.notFound(ERROR_CODES.SCREENING_NOT_FOUND, 'Không tìm thấy túi máu');
      const donor = existing.donation.screening.checkIn.registration.donor;
      const nextStatus = data.status ?? existing.status;
      const nextBloodType = data.bloodType === undefined ? existing.bloodType : data.bloodType;
      if (data.status && data.status !== existing.status) {
        assertBloodBagTransition(existing.status, data.status);
      }
      if (existing.status === 'ACCEPTED' || existing.status === 'DISCARDED') {
        throw AppError.conflict(ERROR_CODES.BLOOD_BAG_INVALID_TRANSITION, 'Không thể sửa túi máu đã kết thúc xử lý');
      }
      if (data.bloodType && nextStatus !== 'TESTED' && nextStatus !== 'ACCEPTED') {
        throw AppError.badRequest(ERROR_CODES.VALIDATION_ERROR, 'Chỉ ghi nhóm máu túi sau khi xét nghiệm');
      }
      if (nextStatus === 'TESTED') {
        if (!nextBloodType || (existing.status !== 'TESTED' && !data.bloodType)) {
          throw AppError.badRequest(ERROR_CODES.VALIDATION_ERROR, 'Cần kết quả ABO và Rh của đợt xét nghiệm này');
        }
        if ((existing.status !== 'TESTED' || data.bloodType !== undefined) && data.confirmBloodTypeResult !== true) {
          throw AppError.badRequest(ERROR_CODES.VALIDATION_ERROR, 'Cần xác nhận kết quả xét nghiệm của đợt này');
        }
      }
      if (nextStatus === 'ACCEPTED' && !nextBloodType) {
        throw AppError.badRequest(ERROR_CODES.VALIDATION_ERROR, 'Không thể tiếp nhận túi máu khi chưa có kết quả nhóm máu');
      }
      if (nextStatus === 'ACCEPTED' && data.confirmBloodTypeResult !== true) {
        throw AppError.badRequest(ERROR_CODES.VALIDATION_ERROR, 'Cần xác nhận lại kết quả xét nghiệm trước khi tiếp nhận túi máu');
      }
      const discrepancy = Boolean(donor.bloodType && nextBloodType && donor.bloodType !== nextBloodType);
      if (nextStatus === 'ACCEPTED' && discrepancy &&
        (data.confirmBloodTypeOverride !== true || !data.bloodTypeOverrideReason?.trim())) {
        throw AppError.conflict(
          ERROR_CODES.VALIDATION_ERROR,
          'Nhóm máu khác hồ sơ. Cần kiểm tra lại, xác nhận và ghi lý do trước khi tiếp nhận túi máu.',
        );
      }
      const { syncDonorProfile, confirmBloodTypeResult, confirmBloodTypeOverride,
        bloodTypeOverrideReason, ...bagData } = data;
      const shouldSyncProfile = nextStatus === 'ACCEPTED' && Boolean(nextBloodType) &&
        syncDonorProfile === true && donor.bloodType !== nextBloodType;
      const claimed = await tx.bloodBag.updateMany({
        where: { id, status: existing.status, bloodType: existing.bloodType },
        data: bagData,
      });
      if (claimed.count !== 1) {
        throw AppError.conflict(ERROR_CODES.BLOOD_BAG_INVALID_TRANSITION, 'Túi máu đã được người khác cập nhật. Vui lòng tải lại.');
      }
      const updatedBag = await tx.bloodBag.findUniqueOrThrow({ where: { id } });

      if (shouldSyncProfile && nextBloodType) {
        const synced = await tx.donorProfile.updateMany({
          where: { id: donor.id, bloodType: donor.bloodType },
          data: { bloodType: nextBloodType },
        });
        if (synced.count !== 1) {
          throw AppError.conflict(ERROR_CODES.VALIDATION_ERROR, 'Hồ sơ nhóm máu vừa được cập nhật. Vui lòng tải lại và đối chiếu.');
        }
      }
      if (nextStatus === 'ACCEPTED' && nextBloodType && syncDonorProfile === true && donor.userId) {
        const formatted = nextBloodType.replace('_POSITIVE', ' (Rh+)').replace('_NEGATIVE', ' (Rh−)');
        notificationToDispatch = await notificationService.create(tx, {
          userId: donor.userId,
          type: 'DONATION',
          title: 'Kết quả xét nghiệm nhóm máu',
          message: `Kết quả nhóm máu đã xác nhận từ đợt hiến "${existing.donation.screening.checkIn.registration.campaign.name}": Nhóm ${formatted}.`,
          channel: 'IN_APP',
        });
      }

      await auditLogService.record({
        ...ctx,
        action: AUDIT_ACTIONS.BLOOD_BAG_STATUS_CHANGED,
        entityType: AUDIT_ENTITY_TYPES.BLOOD_BAG,
        entityId: id,
        metadata: {
          previousStatus: existing.status,
          newStatus: nextStatus,
          previousBloodType: existing.bloodType,
          newBloodType: nextBloodType,
          previousDonorBloodType: donor.bloodType,
          profileSynced: shouldSyncProfile,
          resultNotified: Boolean(notificationToDispatch),
          discrepancyResolved: discrepancy && confirmBloodTypeOverride === true,
          discrepancyReason: discrepancy ? bloodTypeOverrideReason : undefined,
          confirmedResult: confirmBloodTypeResult === true,
        },
      }, tx);

      return updatedBag;
    });

    if (notificationToDispatch) {
      void notificationService.dispatch(notificationToDispatch);
    }

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

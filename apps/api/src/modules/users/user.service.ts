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
import { userRepository as repo } from './user.repository';

const listQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  q: z.string().trim().max(100).optional(),
  role: z.string().trim().optional(),
  isActive: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});
const assignRoleSchema = z.union([
  z.object({
    roleCodes: z
      .array(z.string().trim().min(1))
      .min(1, 'Vui lòng chọn ít nhất một vai trò'),
  }),
  z.object({ roleId: z.string().uuid() }),
]);
const genderEnum = z.enum(['MALE', 'FEMALE', 'OTHER']);
const bloodTypeEnum = z.enum([
  'A_POSITIVE',
  'A_NEGATIVE',
  'B_POSITIVE',
  'B_NEGATIVE',
  'AB_POSITIVE',
  'AB_NEGATIVE',
  'O_POSITIVE',
  'O_NEGATIVE',
]);

const updateUserSchema = z.object({
  fullName: z.string().trim().min(1).max(200).optional(),
  email: z.string().trim().email().max(200).optional(),
  isActive: z.boolean().optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  citizenId: z.string().trim().max(30).nullable().optional(),
  dateOfBirth: z.string().trim().nullable().optional(),
  gender: genderEnum.nullable().optional(),
  bloodType: bloodTypeEnum.nullable().optional(),
  address: z.string().trim().max(500).nullable().optional(),
});

export const userService = {
  async list(query: unknown) {
    const filters = parseDomain(listQuerySchema, query);
    const pagination = resolvePagination(filters);
    const searchTerm = (filters.search || filters.q || '').trim() || undefined;
    const isActiveFilter =
      filters.isActive === 'true'
        ? true
        : filters.isActive === 'false'
          ? false
          : undefined;
    const { items, total } = await repo.list({
      search: searchTerm,
      role: filters.role || undefined,
      isActive: isActiveFilter,
      skip: pagination.skip,
      take: pagination.take,
    });
    return {
      items,
      meta: paginationMeta(pagination.page, pagination.limit, total),
    };
  },

  async update(userId: string, input: unknown, ctx: AuditContext) {
    const data = parseDomain(updateUserSchema, input);
    return repo.transaction(async (tx) => {
      const existing = await repo.findByIdTx(tx, userId);
      if (!existing)
        throw AppError.notFound(
          ERROR_CODES.VALIDATION_ERROR,
          'Không tìm thấy người dùng',
        );

      const normalizedEmail = data.email?.toLowerCase();
      if (normalizedEmail && normalizedEmail !== existing.email.toLowerCase()) {
        const emailOwner = await repo.findByEmailTx(tx, normalizedEmail);
        if (emailOwner && emailOwner.id !== userId) {
          throw AppError.conflict(ERROR_CODES.AUTH_EMAIL_EXISTS);
        }
      }

      const normalizedCitizenId =
        data.citizenId !== undefined
          ? data.citizenId?.trim() || null
          : undefined;
      if (
        normalizedCitizenId &&
        normalizedCitizenId !== existing.donorProfile?.citizenId
      ) {
        const citizenOwner = await repo.findDonorByCitizenIdTx(
          tx,
          normalizedCitizenId,
        );
        if (citizenOwner && citizenOwner.userId !== userId) {
          throw AppError.conflict(ERROR_CODES.AUTH_CITIZEN_ID_EXISTS);
        }
      }

      const hasProfileUpdates =
        data.phone !== undefined ||
        data.citizenId !== undefined ||
        data.dateOfBirth !== undefined ||
        data.gender !== undefined ||
        data.bloodType !== undefined ||
        data.address !== undefined;

      let parsedDob: Date | null | undefined = undefined;
      if (data.dateOfBirth !== undefined) {
        if (!data.dateOfBirth) {
          parsedDob = null;
        } else {
          const d = new Date(data.dateOfBirth);
          if (Number.isNaN(d.getTime())) {
            throw AppError.badRequest(
              ERROR_CODES.VALIDATION_ERROR,
              'Ngày sinh không hợp lệ',
            );
          }
          parsedDob = d;
        }
      }

      const updated = await repo.updateTx(tx, userId, {
        fullName: data.fullName,
        email: normalizedEmail,
        isActive: data.isActive,
        ...(hasProfileUpdates
          ? {
              donorProfile: {
                phone:
                  data.phone !== undefined ? data.phone?.trim() || null : undefined,
                citizenId: normalizedCitizenId,
                dateOfBirth: parsedDob,
                gender: data.gender,
                bloodType: data.bloodType,
                address:
                  data.address !== undefined
                    ? data.address?.trim() || null
                    : undefined,
              },
            }
          : {}),
      });
      await auditLogService.record(
        {
          ...ctx,
          action: AUDIT_ACTIONS.USER_UPDATED,
          entityType: AUDIT_ENTITY_TYPES.USER,
          entityId: userId,
          metadata: { ...data },
        },
        tx,
      );
      return {
        ...updated,
        roles: updated.roles.map((r) => r.role.code),
      };
    });
  },

  async assignRole(userId: string, input: unknown, ctx: AuditContext) {
    const parsed = parseDomain(assignRoleSchema, input);
    return repo.transaction(async (tx) => {
      const user = await repo.findByIdTx(tx, userId);
      if (!user)
        throw AppError.notFound(
          ERROR_CODES.VALIDATION_ERROR,
          'Không tìm thấy người dùng',
        );

      if ('roleCodes' in parsed) {
        const uniqueCodes = [...new Set(parsed.roleCodes)];
        const roles = await repo.findRolesByCodesTx(tx, uniqueCodes);
        if (roles.length !== uniqueCodes.length) {
          throw AppError.notFound(ERROR_CODES.ROLE_NOT_FOUND);
        }

        const updated = await repo.setRolesTx(
          tx,
          userId,
          roles.map((r) => r.id),
        );
        await auditLogService.record(
          {
            ...ctx,
            action: AUDIT_ACTIONS.USER_UPDATED,
            entityType: AUDIT_ENTITY_TYPES.USER,
            entityId: userId,
            metadata: { rolesAssigned: roles.map((r) => r.code) },
          },
          tx,
        );
        return {
          ...updated,
          roles: updated.roles.map((r) => r.role.code),
        };
      }

      const role = await repo.findRoleByIdTx(tx, parsed.roleId);
      if (!role) throw AppError.notFound(ERROR_CODES.ROLE_NOT_FOUND);

      await repo.assignRoleTx(tx, userId, parsed.roleId);
      await auditLogService.record(
        {
          ...ctx,
          action: AUDIT_ACTIONS.USER_UPDATED,
          entityType: AUDIT_ENTITY_TYPES.USER,
          entityId: userId,
          metadata: { roleAssigned: role.code },
        },
        tx,
      );
      return {};
    });
  },
};

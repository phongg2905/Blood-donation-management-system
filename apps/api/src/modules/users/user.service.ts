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
  search: z.string().trim().min(1).max(100).optional(),
  role: z.string().trim().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});
const assignRoleSchema = z.object({ roleId: z.string().uuid() });

export const userService = {
  async list(query: unknown) {
    const filters = parseDomain(listQuerySchema, query);
    const pagination = resolvePagination(filters);
    const { items, total } = await repo.list({
      search: filters.search,
      role: filters.role,
      skip: pagination.skip,
      take: pagination.take,
    });
    return {
      items,
      meta: paginationMeta(pagination.page, pagination.limit, total),
    };
  },

  async assignRole(userId: string, input: unknown, ctx: AuditContext) {
    const { roleId } = parseDomain(assignRoleSchema, input);
    return repo.transaction(async (tx) => {
      const user = await repo.findByIdTx(tx, userId);
      if (!user)
        throw AppError.notFound(
          ERROR_CODES.VALIDATION_ERROR,
          'Không tìm thấy người dùng',
        );
      const role = await repo.findRoleByIdTx(tx, roleId);
      if (!role) throw AppError.notFound(ERROR_CODES.ROLE_NOT_FOUND);

      await repo.assignRoleTx(tx, userId, roleId);
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
    });
  },
};

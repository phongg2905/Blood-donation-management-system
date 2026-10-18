import type { RequestHandler } from 'express';
import { Router } from 'express';
import { sendSuccess } from '../../common/helpers/response';
import { requireAuth } from '../../middlewares/auth.middleware';
import { requirePermission } from '../../middlewares/permission.middleware';
import { database } from '../../config/database';

const list: RequestHandler = async (_req, res) => {
  const permissions = await database.permission.findMany({
    include: {
      roles: {
        include: {
          role: { select: { code: true } },
        },
      },
    },
    orderBy: { code: 'asc' },
  });
  sendSuccess(
    res,
    permissions.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      description: p.description,
      roles: p.roles.map((r) => r.role.code),
    })),
  );
};

export const permissionRoutes = Router();
permissionRoutes.get('/', requireAuth, requirePermission('permission.read'), list);

import type { RequestHandler } from 'express';
import { Router } from 'express';
import { sendSuccess } from '../../common/helpers/response';
import { requireAuth } from '../../middlewares/auth.middleware';
import { requirePermission } from '../../middlewares/permission.middleware';
import { database } from '../../config/database';

const list: RequestHandler = async (_req, res) => {
  const roles = await database.role.findMany({
    include: {
      permissions: { include: { permission: { select: { code: true } } } },
    },
    orderBy: { name: 'asc' },
  });
  sendSuccess(
    res,
    roles.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      permissions: r.permissions.map((p) => p.permission.code),
    })),
  );
};

export const roleRoutes = Router();
roleRoutes.get('/', requireAuth, requirePermission('role.read'), list);

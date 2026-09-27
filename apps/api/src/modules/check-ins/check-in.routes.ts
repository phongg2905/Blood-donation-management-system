import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware';
import { requirePermission } from '../../middlewares/permission.middleware';
import * as controller from './check-in.controller';

export const checkInRoutes = Router();

checkInRoutes.post(
  '/:id/check-in',
  requireAuth,
  requirePermission('registration.checkin'),
  controller.checkIn,
);
checkInRoutes.post(
  '/:id/no-show',
  requireAuth,
  requirePermission('registration.mark_no_show'),
  controller.markNoShow,
);

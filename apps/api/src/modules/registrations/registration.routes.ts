import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware';
import { requirePermission } from '../../middlewares/permission.middleware';
import * as controller from './registration.controller';

export const registrationRoutes = Router();

registrationRoutes.post(
  '/',
  requireAuth,
  requirePermission('registration.create'),
  controller.create,
);
registrationRoutes.get(
  '/:id',
  requireAuth,
  requirePermission('registration.read'),
  controller.getById,
);
registrationRoutes.patch(
  '/:id/schedule',
  requireAuth,
  requirePermission('registration.reschedule'),
  controller.reschedule,
);
registrationRoutes.post(
  '/:id/cancel',
  requireAuth,
  requirePermission('registration.cancel'),
  controller.cancel,
);

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
  '/',
  requireAuth,
  requirePermission('registration.read'),
  controller.search,
);
registrationRoutes.get(
  '/my',
  requireAuth,
  requirePermission('registration.read'),
  controller.my,
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

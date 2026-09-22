import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware';
import { requirePermission } from '../../middlewares/permission.middleware';
import * as authController from './auth.controller';

export const authRoutes = Router();

// Public — no session required.
authRoutes.post('/register', authController.register);
authRoutes.post('/login', authController.login);
authRoutes.post('/refresh', authController.refresh);
authRoutes.post('/logout', authController.logout);
authRoutes.post('/forgot-password', authController.forgotPassword);
authRoutes.post('/reset-password', authController.resetPassword);

// Protected — `authenticate` (mounted globally in app.ts) must have already
// populated req.auth from a verified access token.
authRoutes.get(
  '/me',
  requireAuth,
  requirePermission('auth.profile.read'),
  authController.getMe,
);
authRoutes.patch(
  '/me',
  requireAuth,
  requirePermission('auth.profile.update'),
  authController.updateMe,
);

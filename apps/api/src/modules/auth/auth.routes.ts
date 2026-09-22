import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware';
import { requirePermission } from '../../middlewares/permission.middleware';
import { authRateLimiters } from '../../middlewares/rate-limit.middleware';
import * as authController from './auth.controller';

export const authRoutes = Router();

// Public — no session required. Credential and password-reset endpoints are
// rate limited per IP (brute-force / email-bombing protection; see
// rate-limit.middleware.ts). Refresh/logout stay unlimited: they are
// cookie-scoped session management, not guessable-secret endpoints.
authRoutes.post('/register', authRateLimiters.credentials, authController.register);
authRoutes.post('/login', authRateLimiters.credentials, authController.login);
authRoutes.post('/refresh', authController.refresh);
authRoutes.post('/logout', authController.logout);
authRoutes.post('/forgot-password', authRateLimiters.passwordReset, authController.forgotPassword);
authRoutes.post('/reset-password', authRateLimiters.passwordReset, authController.resetPassword);

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

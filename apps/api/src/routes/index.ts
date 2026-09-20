import { Router } from 'express';
import { authRoutes } from '../modules/auth/auth.routes';
import { healthRoutes } from './health.routes';
export const apiRoutes = Router();
apiRoutes.use('/health', healthRoutes);
apiRoutes.use('/auth', authRoutes);

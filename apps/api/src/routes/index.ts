import { Router } from 'express';
import { authRoutes } from '../modules/auth/auth.routes';
import { registrationRoutes } from '../modules/registrations/registration.routes';
import { checkInRoutes } from '../modules/check-ins/check-in.routes';
import { screeningRoutes } from '../modules/screenings/screening.routes';
import { bloodBagRoutes } from '../modules/blood-bags/blood-bag.routes';
import { notificationRoutes } from '../modules/notifications/notification.routes';
import { certificateRoutes } from '../modules/certificates/certificate.routes';
import { campaignRoutes } from '../modules/donation-campaigns/campaign.routes';
import {
  campaignTimeSlotRoutes,
  timeSlotRoutes,
} from '../modules/time-slots/time-slot.routes';
import { userRoutes } from '../modules/users/user.routes';
import { roleRoutes } from '../modules/roles/role.routes';
import { auditLogRoutes } from '../modules/audit-logs/audit.routes';
import { reportRoutes } from '../modules/reports/report.routes';
import { donorRoutes } from '../modules/donors/donor.routes';
import { healthRoutes } from './health.routes';
export const apiRoutes = Router();
apiRoutes.use('/health', healthRoutes);
apiRoutes.use('/auth', authRoutes);
apiRoutes.use('/registrations', registrationRoutes);
apiRoutes.use('/registrations', checkInRoutes);
apiRoutes.use('/screenings', screeningRoutes);
apiRoutes.use(bloodBagRoutes);
apiRoutes.use('/notifications', notificationRoutes);
apiRoutes.use('/certificates', certificateRoutes);
apiRoutes.use('/campaigns', campaignRoutes);
apiRoutes.use('/campaigns', campaignTimeSlotRoutes);
apiRoutes.use('/time-slots', timeSlotRoutes);
apiRoutes.use('/users', userRoutes);
apiRoutes.use('/roles', roleRoutes);
apiRoutes.use('/audit-logs', auditLogRoutes);
apiRoutes.use('/reports', reportRoutes);
apiRoutes.use('/donors', donorRoutes);

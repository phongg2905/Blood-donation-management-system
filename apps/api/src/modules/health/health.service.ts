import type { HealthResponse } from '@blood/shared-types';
import { healthRepository } from './health.repository';
export const healthService = {
  async check(): Promise<HealthResponse> {
    try {
      await healthRepository.ping();
      return {
        success: true,
        message: 'Blood Donation API is running',
        database: 'connected',
        data: { database: 'connected' },
      };
    } catch {
      return {
        success: false,
        message: 'Database is unavailable',
        database: 'disconnected',
        errors: [{ message: 'PostgreSQL connection failed' }],
      };
    }
  },
};

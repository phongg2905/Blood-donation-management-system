import type { HealthData } from '@blood/shared-types';
import { healthRepository } from './health.repository';

export const healthService = {
  /** Throws when PostgreSQL cannot be reached; the controller maps it to 503. */
  async check(): Promise<HealthData> {
    await healthRepository.ping();
    return {
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString(),
    };
  },
};

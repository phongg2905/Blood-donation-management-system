import { env } from './env';
export const appConfig = {
  port: env.API_PORT,
  corsOrigin: env.CORS_ORIGIN,
  apiPrefix: '/api',
} as const;

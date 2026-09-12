import { PrismaClient } from '@prisma/client';
import { env } from './env';
export const database = new PrismaClient({
  datasourceUrl: env.DATABASE_URL,
  log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

import { PrismaClient } from '@prisma/client';
import { env } from './env';
export const database = new PrismaClient({
  datasourceUrl: env.DATABASE_URL,
  log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  // Auth mutations serialize on a per-user row lock (SELECT ... FOR UPDATE),
  // so contending transactions may legitimately wait for each other. The
  // Prisma defaults (2s maxWait / 5s timeout) are too tight for that: a
  // concurrent reset-password race must return a clean 400, not P2028/500.
  transactionOptions: {
    maxWait: 10_000,
    timeout: 20_000,
  },
});

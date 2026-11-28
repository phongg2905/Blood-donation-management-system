import { Prisma, PrismaClient } from '@prisma/client';
import { setTimeout as delay } from 'node:timers/promises';
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

/** Retry serialization conflicts so a capacity race returns a domain error. */
export async function serializableTransaction<T>(
  work: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await database.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== 'P2034' ||
        attempt >= 5
      )
        throw error;
      // Concurrent writers should not immediately collide again on the retry.
      await delay(25 * 2 ** attempt + Math.floor(Math.random() * 25));
    }
  }
}

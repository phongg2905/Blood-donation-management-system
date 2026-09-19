import { config } from 'dotenv';
import { resolve } from 'node:path';
import { z } from 'zod';

config({ path: resolve(__dirname, '../../../../.env'), quiet: true });

const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z
    .string()
    .url()
    .regex(/^postgres(ql)?:\/\//),
  CORS_ORIGIN: z.string().url().default('http://localhost:5173'),

  // Phase 2 auth strategy. Optional so Phase 1 runs without them; the auth
  // module will refuse to start a token flow when the secrets are absent.
  JWT_ACCESS_SECRET: z.string().min(32).optional(),
  JWT_REFRESH_SECRET: z.string().min(32).optional(),
  ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),

  // Initial admin seed. No credential is ever hard-coded in source.
  ADMIN_EMAIL: z.string().regex(emailPattern).optional(),
  ADMIN_PASSWORD: z.string().min(12).optional(),
  ADMIN_FULL_NAME: z.string().min(1).max(200).optional(),
});

export const env = envSchema.parse(process.env);

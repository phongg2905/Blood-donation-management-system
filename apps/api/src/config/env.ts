import { config } from 'dotenv';
import { resolve } from 'node:path';
import { z } from 'zod';

config({ path: resolve(__dirname, '../../../../.env'), quiet: true });

const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const envSchema = z.object({
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
  RESET_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(30),
  RESET_PASSWORD_URL: z.string().url().optional(),
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  SMTP_SECURE: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASSWORD: z.string().min(1).optional(),
  SMTP_FROM: z.string().regex(emailPattern).optional(),

  // Initial admin seed. No credential is ever hard-coded in source.
  ADMIN_EMAIL: z.string().regex(emailPattern).optional(),
  ADMIN_PASSWORD: z.string().min(12).optional(),
  ADMIN_FULL_NAME: z.string().min(1).max(200).optional(),
}).superRefine((value, ctx) => {
  const missing = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message });
  if (Boolean(value.SMTP_USER) !== Boolean(value.SMTP_PASSWORD)) {
    missing('SMTP_USER', 'SMTP_USER and SMTP_PASSWORD must be configured together');
  }
  if (value.SMTP_HOST && !value.SMTP_FROM) missing('SMTP_FROM', 'SMTP_FROM is required with SMTP_HOST');
  if (value.SMTP_FROM && !value.SMTP_HOST) missing('SMTP_HOST', 'SMTP_HOST is required with SMTP_FROM');
  if (value.NODE_ENV === 'production') {
    if (!value.JWT_ACCESS_SECRET) missing('JWT_ACCESS_SECRET', 'Access signing secret is required in production');
    if (!value.JWT_REFRESH_SECRET) missing('JWT_REFRESH_SECRET', 'Refresh signing secret is required in production');
    if (value.JWT_ACCESS_SECRET === value.JWT_REFRESH_SECRET) missing('JWT_REFRESH_SECRET', 'Use different access and refresh secrets');
    if (!value.SMTP_HOST) missing('SMTP_HOST', 'SMTP delivery is required in production');
    if (!value.RESET_PASSWORD_URL?.startsWith('https://')) missing('RESET_PASSWORD_URL', 'An HTTPS reset page URL is required in production');
  }
});

export const env = envSchema.parse(process.env);

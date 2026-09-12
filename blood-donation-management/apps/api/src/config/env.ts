import { config } from 'dotenv';
import { resolve } from 'node:path';
import { z } from 'zod';

config({ path: resolve(__dirname, '../../../../.env'), quiet: true });
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
});
export const env = envSchema.parse(process.env);

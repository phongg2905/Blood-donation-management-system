import { config } from 'dotenv';
import { resolve } from 'node:path';
import { defineConfig } from 'prisma/config';
config({ path: resolve(__dirname, '../../.env'), quiet: true });
// Local PostgreSQL needs no separate pooler/direct connection URL.
process.env.DIRECT_URL ||= process.env.DATABASE_URL;
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
});

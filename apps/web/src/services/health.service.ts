import type { DatabaseStatus } from '@blood/shared-types';
import { apiGet } from '@/services/api';

/** `GET /api/health` — API and database reachability. */
export const getHealth = (signal?: AbortSignal) =>
  apiGet<{ database: DatabaseStatus }>('/health', { signal, anonymous: true });

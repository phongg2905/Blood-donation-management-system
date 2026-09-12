import type { DatabaseStatus } from '@blood/shared-types';
import { apiGet } from './api';
export const getHealth = (signal?: AbortSignal) =>
  apiGet<{ database: DatabaseStatus }>('/health', signal);

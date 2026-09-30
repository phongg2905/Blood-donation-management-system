import { apiGet, apiPatch } from '@/services/api';
import type { NotificationItem, NotificationListResult } from '../types';

export const notificationService = {
  async list(params?: { page?: number; limit?: number }): Promise<NotificationListResult> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));

    const qs = searchParams.toString();
    const path = `/notifications${qs ? `?${qs}` : ''}`;

    const response = await apiGet<NotificationItem[]>(path);
    return {
      items: response.data ?? [],
      meta: response.meta,
    };
  },

  async markRead(id: string): Promise<void> {
    await apiPatch<Record<string, never>>(`/notifications/${encodeURIComponent(id)}/read`);
  },
};

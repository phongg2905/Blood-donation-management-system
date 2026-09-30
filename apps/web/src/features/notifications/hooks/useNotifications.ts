import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { notificationService } from '../services/notification.service';
import type { NotificationItem } from '../types';

export function useNotifications() {
  const { currentUser, hasPermission } = useAuth();
  const canReadNotifications = Boolean(currentUser && hasPermission('notification.read'));

  const [items, setItems] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unreadCount = useMemo(
    () => items.filter((n) => !n.readAt).length,
    [items],
  );

  const refresh = useCallback(async () => {
    if (!canReadNotifications) return;
    try {
      setError(null);
      const res = await notificationService.list({ limit: 30 });
      setItems(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải thông báo');
    } finally {
      setIsLoading(false);
    }
  }, [canReadNotifications]);

  // Initial fetch and on auth state change
  useEffect(() => {
    if (!canReadNotifications) {
      setItems([]);
      return;
    }

    setIsLoading(true);
    void refresh();

    // Polling interval (every 45s while page is visible)
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        void refresh();
      }
    }, 45_000);

    const onFocus = () => {
      void refresh();
    };
    window.addEventListener('focus', onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [canReadNotifications, refresh]);

  const markAsRead = useCallback(
    async (id: string) => {
      // Optimistic update
      setItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, readAt: item.readAt ?? new Date().toISOString() }
            : item,
        ),
      );

      try {
        await notificationService.markRead(id);
      } catch {
        // Fallback to server state if failed
        void refresh();
      }
    },
    [refresh],
  );

  const markAllAsRead = useCallback(async () => {
    const unreadItems = items.filter((i) => !i.readAt);
    if (unreadItems.length === 0) return;

    // Optimistically mark all as read
    const now = new Date().toISOString();
    setItems((prev) => prev.map((item) => ({ ...item, readAt: item.readAt ?? now })));

    await Promise.allSettled(
      unreadItems.map((item) => notificationService.markRead(item.id)),
    );
  }, [items]);

  return {
    items,
    unreadCount,
    isLoading,
    error,
    refresh,
    markAsRead,
    markAllAsRead,
    canReadNotifications,
  };
}

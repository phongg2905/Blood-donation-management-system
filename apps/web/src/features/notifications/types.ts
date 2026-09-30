import type {
  NotificationChannel,
  NotificationStatus,
  NotificationType,
  PaginationMeta,
} from '@blood/shared-types';

export interface NotificationItem {
  id: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  channel: NotificationChannel;
  status: NotificationStatus;
  sentAt?: string | null;
  readAt?: string | null;
}

export interface NotificationListResult {
  items: NotificationItem[];
  meta?: PaginationMeta;
}

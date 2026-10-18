import type { NotificationType } from '@blood/shared-types';
import type { LucideIcon } from 'lucide-react';
import { Calendar, Droplet, Award, Megaphone, Settings, Info } from 'lucide-react';

export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) {
    return 'Vừa xong';
  }
  if (diffMin < 60) {
    return `${diffMin} phút trước`;
  }
  if (diffHour < 24) {
    return `${diffHour} giờ trước`;
  }
  if (diffDay < 7) {
    return `${diffDay} ngày trước`;
  }

  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function getNotificationBadge(type: NotificationType): { label: string; icon: LucideIcon; className: string } {
  switch (type) {
    case 'REGISTRATION':
      return { label: 'Đăng ký', icon: Calendar, className: 'notif-badge--reg' };
    case 'DONATION':
      return { label: 'Hiến máu', icon: Droplet, className: 'notif-badge--donation' };
    case 'CERTIFICATE':
      return { label: 'Chứng nhận', icon: Award, className: 'notif-badge--cert' };
    case 'CAMPAIGN':
      return { label: 'Chiến dịch', icon: Megaphone, className: 'notif-badge--campaign' };
    case 'SYSTEM':
      return { label: 'Hệ thống', icon: Settings, className: 'notif-badge--system' };
    case 'GENERAL':
    default:
      return { label: 'Thông báo', icon: Info, className: 'notif-badge--general' };
  }
}


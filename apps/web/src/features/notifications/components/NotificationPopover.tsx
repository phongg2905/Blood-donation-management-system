import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { NotificationItem } from '../types';
import { formatRelativeTime, getNotificationBadge } from '../utils';

export interface NotificationPopoverProps {
  items: NotificationItem[];
  unreadCount: number;
  isLoading: boolean;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClose: () => void;
}

export function NotificationPopover({
  items,
  unreadCount,
  isLoading,
  onMarkAsRead,
  onMarkAllAsRead,
  onClose,
}: NotificationPopoverProps) {
  const navigate = useNavigate();

  const handleItemClick = (item: NotificationItem) => {
    if (!item.readAt) {
      onMarkAsRead(item.id);
    }

    // Contextual navigation
    if (item.type === 'CERTIFICATE') {
      navigate('/donor/certificates');
    } else if (item.type === 'REGISTRATION' || item.type === 'DONATION') {
      navigate('/donor/history');
    }

    onClose();
  };

  return (
    <div className="notif-popover" role="dialog" aria-label="Trung tâm thông báo">
      <div className="notif-popover__header">
        <div className="notif-popover__title-wrap">
          <span className="notif-popover__title">Thông báo</span>
          {unreadCount > 0 && (
            <span className="notif-popover__badge" aria-label={`${unreadCount} chưa đọc`}>
              {unreadCount} mới
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            className="notif-popover__mark-all"
            onClick={onMarkAllAsRead}
          >
            Đã đọc tất cả
          </button>
        )}
      </div>

      <div className="notif-popover__content">
        {isLoading && items.length === 0 ? (
          <div className="notif-popover__loading">Đang tải thông báo…</div>
        ) : items.length === 0 ? (
          <div className="notif-popover__empty">
            <span className="notif-popover__empty-icon" aria-hidden="true">
              📭
            </span>
            <p>Hiện bạn không có thông báo nào.</p>
          </div>
        ) : (
          <ul className="notif-list" role="list">
            {items.map((item) => {
              const badge = getNotificationBadge(item.type);
              const isUnread = !item.readAt;

              return (
                <li
                  key={item.id}
                  className={`notif-item ${isUnread ? 'notif-item--unread' : ''}`}
                  onClick={() => handleItemClick(item)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleItemClick(item);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`${item.title} - ${isUnread ? 'chưa đọc' : 'đã đọc'}`}
                >
                  <div className={`notif-item__icon ${badge.className}`} aria-hidden="true">
                    {badge.icon}
                  </div>
                  <div className="notif-item__body">
                    <div className="notif-item__header-row">
                      <span className="notif-item__type-tag">{badge.label}</span>
                      <span className="notif-item__time">
                        {formatRelativeTime(item.createdAt)}
                      </span>
                    </div>
                    <h4 className="notif-item__title">{item.title}</h4>
                    <p className="notif-item__message">{item.message}</p>
                  </div>
                  {isUnread && (
                    <span className="notif-item__dot" aria-hidden="true" title="Chưa đọc" />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

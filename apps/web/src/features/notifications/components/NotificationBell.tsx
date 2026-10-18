import React, { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import { NotificationPopover } from './NotificationPopover';

export function NotificationBell() {
  const {
    items,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    canReadNotifications,
  } = useNotifications();

  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (!canReadNotifications) {
    return null;
  }

  return (
    <div className="notif-wrapper" ref={containerRef}>
      <button
        type="button"
        className={`notif-bell-btn ${isOpen ? 'notif-bell-btn--active' : ''}`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={`Thông báo ${unreadCount > 0 ? `(${unreadCount} chưa đọc)` : ''}`}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <Bell className="notif-bell-icon" size={20} aria-hidden="true" />

        {unreadCount > 0 && (
          <span className="notif-bell-badge" aria-hidden="true">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <NotificationPopover
          items={items}
          unreadCount={unreadCount}
          isLoading={isLoading}
          onMarkAsRead={markAsRead}
          onMarkAllAsRead={markAllAsRead}
          onClose={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}

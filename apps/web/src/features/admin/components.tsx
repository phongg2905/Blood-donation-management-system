import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Button } from '@/components/ui';
import { Feedback } from '@/features/campaigns/components';
import { mockAdminEnabled } from './repository';

export function AdminShell({
  eyebrow = 'Quản trị hệ thống',
  title,
  lead,
  children,
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  children: ReactNode;
}) {
  return (
    <div className="admin-page">
      <header className="admin-heading">
        <p className="admin-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {lead && <p className="admin-lead">{lead}</p>}
      </header>
      {mockAdminEnabled && (
        <p className="admin-demo" role="note">
          Dữ liệu quản trị minh họa cho phát triển, không phải dữ liệu hệ thống
          thật. Thay đổi sẽ được đặt lại khi tải lại trang.
        </p>
      )}
      {children}
    </div>
  );
}

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export function AdminBadge({
  tone = 'neutral',
  children,
}: {
  tone?: BadgeTone;
  children: ReactNode;
}) {
  return <span className={`admin-badge admin-badge--${tone}`}>{children}</span>;
}

/** Native modal: focus containment plus focus restoration on close. */
export function AdminDialog({
  title,
  children,
  pending,
  error,
  confirmLabel = 'Lưu thay đổi',
  confirmDisabled = false,
  onCancel,
  onConfirm,
}: {
  title: string;
  children: ReactNode;
  pending: boolean;
  error?: { message: string } | null;
  confirmLabel?: string;
  confirmDisabled?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const trigger = useRef(document.activeElement as HTMLElement | null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current;
    const previousFocus = trigger.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
      previousFocus?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="admin-dialog"
      aria-labelledby={id}
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        const buttons = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)',
          ),
        );
        const first = buttons[0];
        const last = buttons.at(-1);
        if (!first) {
          event.preventDefault();
          event.currentTarget.focus();
        } else if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onCancel();
      }}
    >
      <h2 id={id}>{title}</h2>
      {children}
      <Feedback error={error} />
      <div className="admin-actions">
        <Button variant="secondary" disabled={pending} onClick={onCancel}>
          Hủy
        </Button>
        <Button
          variant="primary"
          isLoading={pending}
          disabled={confirmDisabled}
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}

export function AdminPagination({
  page,
  totalPages,
  total,
  onChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onChange: (page: number) => void;
}) {
  return (
    <nav className="admin-pagination" aria-label="Phân trang">
      <span className="admin-muted">
        {total.toLocaleString('vi-VN')} bản ghi · Trang {page} /{' '}
        {Math.max(1, totalPages)}
      </span>
      <div className="admin-actions">
        <Button
          variant="secondary"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          Trang trước
        </Button>
        <Button
          variant="secondary"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
        >
          Trang sau
        </Button>
      </div>
    </nav>
  );
}

export function AdminDenied({ permission }: { permission: string }) {
  return (
    <p className="admin-empty" role="status">
      Cần quyền <code>{permission}</code> để thực hiện thao tác này.
    </p>
  );
}

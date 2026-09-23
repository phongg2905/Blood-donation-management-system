import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui';
import { describeError, STATUS_LABELS } from './domain';
import { mockCampaignsEnabled } from './repository';
import type { Campaign } from './types';

export function CampaignShell({
  title,
  lead,
  children,
  back = '/campaigns',
}: {
  title: string;
  lead?: string;
  children: ReactNode;
  back?: string;
}) {
  return (
    <div className="campaign-page">
      <header className="campaign-heading">
        <Link to={back}>
          {back === '/campaigns' ? 'Đợt hiến máu' : 'Về chi tiết đợt hiến'}
        </Link>
        <p className="campaign-eyebrow">Kết nối cộng đồng · Sẻ chia sự sống</p>
        <h1>{title}</h1>
        {lead && <p>{lead}</p>}
      </header>
      {mockCampaignsEnabled && (
        <p className="campaign-demo" role="note">
          Dữ liệu minh họa dành cho phát triển, không phải lịch hiến máu thật.
          Thay đổi sẽ được đặt lại khi tải lại trang.
        </p>
      )}
      {children}
    </div>
  );
}
export function StatusBadge({ status }: { status: Campaign['status'] }) {
  return (
    <span
      className={`campaign-status campaign-status--${status.toLowerCase()}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
export function QueryState({
  loading,
  error,
  retry,
}: {
  loading: boolean;
  error: unknown;
  retry: () => void;
}) {
  if (loading)
    return (
      <div
        className="campaign-loading"
        role="status"
        aria-label="Đang tải dữ liệu"
      >
        <span>Đang tải dữ liệu…</span>
        <div />
        <div />
        <div />
      </div>
    );
  if (error)
    return (
      <div className="campaign-empty" role="alert">
        <h2>Chưa thể tải dữ liệu</h2>
        <p>{describeError(error).message}</p>
        <Button variant="secondary" onClick={retry}>
          Thử lại
        </Button>
      </div>
    );
  return null;
}
export function Feedback({
  error,
  success,
}: {
  error?: { message: string } | null;
  success?: string;
}) {
  return (
    <>
      {error && (
        <p className="campaign-error" role="alert">
          {error.message}
        </p>
      )}
      {success && (
        <p className="campaign-success" role="status">
          {success}
        </p>
      )}
    </>
  );
}
/** Native modal supplies focus containment/inert background; restore the trigger on close. */
export function ConfirmDialog({
  title,
  children,
  pending,
  onCancel,
  onConfirm,
  error,
  label = 'Xác nhận',
}: {
  title: string;
  children: ReactNode;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  error?: { message: string } | null;
  label?: string;
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
      className="campaign-dialog"
      aria-labelledby={id}
      aria-describedby={`${id}-description`}
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        const buttons = Array.from(
          event.currentTarget.querySelectorAll<HTMLButtonElement>(
            'button:not(:disabled)',
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
      <div id={`${id}-description`}>{children}</div>
      <Feedback error={error} />
      <div className="campaign-actions">
        <Button
          variant="secondary"
          autoFocus
          disabled={pending}
          onClick={onCancel}
        >
          Quay lại
        </Button>
        <Button variant="danger" isLoading={pending} onClick={onConfirm}>
          {label}
        </Button>
      </div>
    </dialog>
  );
}

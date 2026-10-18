import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  Button,
  SkeletonList,
  SkeletonWorkflowList,
  SkeletonCampaignList,
  SkeletonReadyQueue,
  SkeletonTable,
  SkeletonCard,
  SkeletonStats,
  SkeletonProfile,
  SkeletonForm,
  SkeletonCampaignDetail,
  SkeletonScreeningForm,
  SkeletonStationGrid,
  SkeletonHistoryList,
  SkeletonRoleGrid,
  SkeletonDemandGrid,
} from '@/components/ui';
import { describeError, STATUS_LABELS } from './domain';
import type { Campaign } from './types';

export function CampaignShell({
  title,
  lead,
  children,
  back,
  backLabel,
  actions,
}: {
  title?: string;
  lead?: string;
  children: ReactNode;
  back?: string;
  backLabel?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="campaign-page">
      {(title || back) && (
        <header className="campaign-heading">
          {back && (
            <div className="campaign-heading__nav">
              <Link to={back} className="campaign-back-link">
                {backLabel ?? (back === '/campaigns' ? '← Danh sách đợt hiến' : '← Quay lại')}
              </Link>
            </div>
          )}
          <div className="campaign-heading__row">
            {title && <h1>{title}</h1>}
            {actions}
          </div>
          {lead && <p className="campaign-lead">{lead}</p>}
        </header>
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
  variant = 'list',
  count,
  columns,
}: {
  loading: boolean;
  error: unknown;
  retry: () => void;
  variant?:
    | 'list'
    | 'workflow-list'
    | 'campaign-list'
    | 'ready-queue'
    | 'table'
    | 'card'
    | 'stats'
    | 'profile'
    | 'form'
    | 'campaign-detail'
    | 'screening-detail'
    | 'station-grid'
    | 'history-list'
    | 'role-grid'
    | 'demand-grid';
  count?: number;
  columns?: number;
}) {
  if (loading) {
    let skeleton: ReactNode;
    switch (variant) {
      case 'workflow-list':
        skeleton = <SkeletonWorkflowList count={count ?? 3} />;
        break;
      case 'campaign-list':
        skeleton = <SkeletonCampaignList count={count ?? 3} />;
        break;
      case 'ready-queue':
        skeleton = <SkeletonReadyQueue count={count ?? 3} />;
        break;
      case 'table':
        skeleton = <SkeletonTable rows={count ?? 5} columns={columns ?? 4} />;
        break;
      case 'card':
        skeleton = <SkeletonCard count={count ?? 3} />;
        break;
      case 'stats':
        skeleton = <SkeletonStats count={count ?? 4} />;
        break;
      case 'profile':
        skeleton = <SkeletonProfile />;
        break;
      case 'form':
        skeleton = <SkeletonForm fields={count ?? 4} />;
        break;
      case 'campaign-detail':
        skeleton = <SkeletonCampaignDetail />;
        break;
      case 'screening-detail':
        skeleton = <SkeletonScreeningForm />;
        break;
      case 'station-grid':
        skeleton = <SkeletonStationGrid count={count ?? 3} />;
        break;
      case 'history-list':
        skeleton = <SkeletonHistoryList count={count ?? 3} />;
        break;
      case 'role-grid':
        skeleton = <SkeletonRoleGrid count={count ?? 4} />;
        break;
      case 'demand-grid':
        skeleton = <SkeletonDemandGrid count={count ?? 3} />;
        break;
      case 'list':
      default:
        skeleton = <SkeletonList count={count ?? 3} />;
        break;
    }

    return (
      <div
        className="query-state-loading"
        role="status"
        aria-label="Đang tải dữ liệu"
      >
        <span className="visually-hidden">Đang tải dữ liệu…</span>
        {skeleton}
      </div>
    );
  }
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

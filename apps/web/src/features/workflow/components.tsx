import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Clock, ChevronLeft, ChevronRight } from 'lucide-react';

/** Mock note is disabled in production and local runtime */
export function MockNote() {
  return null;
}

import { OPERATIONAL_STATUS_SHORT_LABELS, formatDate } from './domain';

export function WorkflowShell({
  eyebrow,
  title,
  contextBadge,
  lead,
  back,
  backLabel,
  actions,
  children,
}: {
  eyebrow?: string;
  title?: string;
  contextBadge?: ReactNode;
  lead?: string;
  back?: string;
  backLabel?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const displayBackLabel = backLabel
    ? backLabel.startsWith('←')
      ? backLabel
      : `← ${backLabel}`
    : '← Quay lại';

  const hasHeader = Boolean(title || back || actions || eyebrow || lead);

  return (
    <div className="workflow-page">
      {hasHeader && (
        <header className="workflow-heading">
          {back && (
            <div className="workflow-heading__nav">
              <Link to={back} className="workflow-back-link">
                {displayBackLabel}
              </Link>
            </div>
          )}
          {eyebrow && <p className="workflow-eyebrow">{eyebrow}</p>}
          {(title || actions || contextBadge) && (
            <div className="workflow-heading__row">
              <div className="workflow-heading__title-box">
                {title && <h1>{title}</h1>}
                {contextBadge}
              </div>
              {actions}
            </div>
          )}
          {lead && <p className="workflow-lead">{lead}</p>}
        </header>
      )}
      {children}
    </div>
  );
}

/** Unified, compact station workstation header */
export function StationCompactHeader({
  campaign,
  activeStation,
  operationalWindow,
  actions,
}: {
  campaign: { id: string; name: string; location: string; startsAt: string; endsAt: string };
  activeStation: 'checkin' | 'screening' | 'bloodbags';
  operationalWindow?: {
    status: 'ACTIVE' | 'UPCOMING' | 'CLOSED';
    isOpen: boolean;
    message: string;
  } | null;
  actions?: ReactNode;
}) {
  return (
    <section className="station-compact-header" aria-label="Thông tin đợt tác nghiệp">
      <div className="station-compact-header__main">
        <div className="station-compact-header__info">
          <div className="station-compact-header__title-group">
            <h2 className="station-compact-header__title">{campaign.name}</h2>
            {operationalWindow && (
              <span
                className={`station-badge-live station-badge-live--${operationalWindow.status.toLowerCase()}`}
              >
                {OPERATIONAL_STATUS_SHORT_LABELS[operationalWindow.status]}
              </span>
            )}
          </div>
          <div className="station-compact-header__meta">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <MapPin size={14} style={{ flexShrink: 0, opacity: 0.75 }} />
              {campaign.location}
            </span>
            <span>·</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Clock size={14} style={{ flexShrink: 0, opacity: 0.75 }} />
              {formatDate(campaign.startsAt)} (
              {new Date(campaign.startsAt).toLocaleTimeString('vi-VN', {
                hour: '2-digit',
                minute: '2-digit',
              })}{' '}
              –{' '}
              {new Date(campaign.endsAt).toLocaleTimeString('vi-VN', {
                hour: '2-digit',
                minute: '2-digit',
              })}
              )
            </span>
          </div>
        </div>
        {actions && <div className="station-compact-header__actions">{actions}</div>}
      </div>
      <nav className="station-compact-nav" aria-label="Điều hướng tác nghiệp tại điểm hiến">
        <Link
          className={`station-compact-tab ${activeStation === 'checkin' ? 'station-compact-tab--active' : ''}`}
          to={`/campaigns/${campaign.id}/check-in`}
        >
          Quầy tiếp nhận
        </Link>
        <Link
          className={`station-compact-tab ${activeStation === 'screening' ? 'station-compact-tab--active' : ''}`}
          to={`/campaigns/${campaign.id}/screening`}
        >
          Hàng chờ sàng lọc
        </Link>
        <Link
          className={`station-compact-tab ${activeStation === 'bloodbags' ? 'station-compact-tab--active' : ''}`}
          to={`/campaigns/${campaign.id}/blood-bags`}
        >
          Quản lý túi máu
        </Link>
        <Link
          className="station-compact-tab station-compact-tab--link"
          to={`/campaigns/${campaign.id}`}
        >
          Chi tiết đợt hiến ↗
        </Link>
      </nav>
    </section>
  );
}

export type PillTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export function StatusPill({
  tone = 'neutral',
  children,
}: {
  tone?: PillTone;
  children: ReactNode;
}) {
  return <span className={`pill pill--${tone}`}>{children}</span>;
}

export interface StepDefinition {
  id: string;
  label: string;
}

export function Stepper({
  steps,
  current,
}: {
  steps: readonly StepDefinition[];
  current: number;
}) {
  return (
    <ol className="workflow-steps" aria-label="Các bước đăng ký">
      {steps.map((step, index) => {
        const state =
          index < current ? 'done' : index === current ? 'current' : 'todo';
        return (
          <li key={step.id} className={`workflow-step workflow-step--${state}`}>
            <span className="workflow-step__index" aria-hidden="true">
              {index + 1}
            </span>
            <span className="workflow-step__label">{step.label}</span>
            <span className="visually-hidden">
              {state === 'done'
                ? ' (đã hoàn thành)'
                : state === 'current'
                  ? ' (đang thực hiện)'
                  : ''}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

const hash = (value: string): number => {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
};

const cellOn = (seed: number, x: number, y: number): boolean => {
  const mix = Math.imul(seed ^ Math.imul(x + 7, 73856093), 2246822519);
  const mix2 = Math.imul(mix ^ Math.imul(y + 13, 19349663), 3266489917);
  return ((mix2 >>> 9) & 1) === 1;
};

/**
 * Visual placeholder for the appointment code — it is NOT a scannable QR code
 * (no QR encoder is installed). The code itself is rendered next to it so the
 * check-in desk can type it.
 */
export function QrPlaceholder({ code }: { code: string }) {
  const seed = hash(code);
  const size = 21;
  const cells: boolean[] = [];
  for (let y = 0; y < size; y += 1)
    for (let x = 0; x < size; x += 1) cells.push(cellOn(seed, x, y));
  return (
    <figure className="workflow-qr">
      <div
        className="workflow-qr__grid"
        aria-hidden="true"
        style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}
      >
        {cells.map((on, index) => (
          <span key={index} className={on ? 'workflow-qr__on' : undefined} />
        ))}
      </div>
      <figcaption>
        Mã QR định danh lịch hẹn. Vui lòng xuất trình mã này hoặc đọc mã đăng ký khi đến quầy tiếp nhận.
      </figcaption>
    </figure>
  );
}

/** Small key/value list used across review and detail screens. */
export function DetailList({
  items,
}: {
  items: readonly { label: string; value: ReactNode }[];
}) {
  return (
    <dl className="workflow-detail">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

type PaginationToken = number | 'ellipsis-start' | 'ellipsis-end';

function buildPaginationTokens(page: number, totalPages: number): PaginationToken[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, idx) => idx + 1);
  }
  if (page <= 4) {
    return [1, 2, 3, 4, 5, 'ellipsis-end', totalPages];
  }
  if (page >= totalPages - 3) {
    return [
      1,
      'ellipsis-start',
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    ];
  }
  return [
    1,
    'ellipsis-start',
    page - 1,
    page,
    page + 1,
    'ellipsis-end',
    totalPages,
  ];
}

export function WorkflowPagination({
  page,
  totalPages,
  total,
  onChange,
  itemLabel = 'bản ghi',
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize?: number;
  onChange: (page: number) => void;
  itemLabel?: string;
}) {
  if (total <= 0) return null;

  const safeTotalPages = Math.max(1, totalPages);
  const tokens = buildPaginationTokens(page, safeTotalPages);

  return (
    <nav className="workflow-pagination" aria-label={`Phân trang ${itemLabel}`}>
      <div className="workflow-pagination__controls">
        <button
          type="button"
          className="workflow-pagination__page-btn workflow-pagination__nav-btn"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          aria-label="Trang trước"
        >
          <ChevronLeft size={16} strokeWidth={2.2} aria-hidden="true" />
        </button>
        <div className="workflow-pagination__pages">
          {tokens.map((token) =>
            typeof token === 'number' ? (
              <button
                key={token}
                type="button"
                className={`workflow-pagination__page-btn ${
                  token === page ? 'workflow-pagination__page-btn--active' : ''
                }`}
                onClick={() => onChange(token)}
                aria-current={token === page ? 'page' : undefined}
                aria-label={`Trang ${token}`}
              >
                {token}
              </button>
            ) : (
              <span
                key={token}
                className="workflow-pagination__ellipsis"
                aria-hidden="true"
              >
                ...
              </span>
            ),
          )}
        </div>
        <button
          type="button"
          className="workflow-pagination__page-btn workflow-pagination__nav-btn"
          disabled={page >= safeTotalPages}
          onClick={() => onChange(page + 1)}
          aria-label="Trang sau"
        >
          <ChevronRight size={16} strokeWidth={2.2} aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}


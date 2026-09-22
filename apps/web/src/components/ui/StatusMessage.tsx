import type { ReactNode } from 'react';

export type StatusTone = 'error' | 'success' | 'warning' | 'info';

const ICONS: Record<StatusTone, string> = {
  error: '✕',
  success: '✓',
  warning: '!',
  info: 'i',
};

export interface StatusMessageProps {
  tone?: StatusTone;
  title?: string;
  children?: ReactNode;
  /** Extra context, such as a raw API error code. */
  detail?: ReactNode;
  className?: string;
}

/**
 * Inline alert with circular icon badge.
 *
 * `error` and `warning` use `role="alert"` so they are announced immediately;
 * quieter tones use `role="status"`.
 */
export function StatusMessage({
  tone = 'info',
  title,
  children,
  detail,
  className,
}: StatusMessageProps) {
  const classes = ['status', `status--${tone}`, className]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={classes}
      role={tone === 'error' || tone === 'warning' ? 'alert' : 'status'}
    >
      <span className="status__icon" aria-hidden="true">
        {ICONS[tone]}
      </span>
      <div className="status__body">
        {title ? <strong>{title}</strong> : null}
        {children ? <span>{children}</span> : null}
        {detail ? <span className="status__detail">{detail}</span> : null}
      </div>
    </div>
  );
}

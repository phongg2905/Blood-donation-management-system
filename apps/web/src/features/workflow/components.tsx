import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

/** Reminds the user that workflow data is illustrative until the API lands. */
export function MockNote({ children }: { children?: ReactNode }) {
  return (
    <p className="workflow-demo" role="note">
      {children ??
        'Dữ liệu minh họa cho phát triển, không phải hồ sơ hiến máu thật. Mọi thay đổi sẽ mất khi tải lại trang.'}
    </p>
  );
}

export function WorkflowShell({
  eyebrow,
  title,
  lead,
  back,
  backLabel,
  actions,
  children,
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  back?: string;
  backLabel?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="workflow-page">
      <header className="workflow-heading">
        {back && <Link to={back}>{backLabel ?? 'Quay lại'}</Link>}
        {eyebrow && <p className="workflow-eyebrow">{eyebrow}</p>}
        <div className="workflow-heading__row">
          <h1>{title}</h1>
          {actions}
        </div>
        {lead && <p className="workflow-lead">{lead}</p>}
      </header>
      {children}
    </div>
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
        Mã QR minh họa (chưa quét được). Vui lòng dùng mã đăng ký khi đến quầy
        tiếp nhận.
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

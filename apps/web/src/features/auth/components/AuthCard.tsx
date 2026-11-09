import type { ReactNode } from 'react';
import { AuthFooter } from './AuthFooter';

export interface AuthCardProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  /** Cross-links rendered in the footer; omit to hide the footer. */
  footer?: ReactNode;
  children: ReactNode;
}

/**
 * Single card shell for every auth screen.
 *
 * Login, register, forgot-password and reset-password all render through this
 * component, so their framing can never drift apart.
 *
 * The card renders inside `.auth-form-panel`; it carries no background or
 * border of its own — the panel provides the white surface.
 */
export function AuthCard({
  title,
  subtitle,
  eyebrow,
  footer,
  children,
}: AuthCardProps) {
  return (
    <section className="auth-card">
      <header className="auth-card__header">
        <div className="auth-card__badge-icon" aria-hidden="true">
          <svg
            className="auth-card__drop-icon"
            viewBox="0 0 24 24"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
          </svg>
        </div>
        {eyebrow ? <span className="auth-card__eyebrow">{eyebrow}</span> : null}
        <h1 className="auth-card__title">{title}</h1>
        {subtitle ? <p className="auth-card__subtitle">{subtitle}</p> : null}
      </header>

      <div className="auth-card__body">{children}</div>

      {footer ? <AuthFooter>{footer}</AuthFooter> : null}
    </section>
  );
}

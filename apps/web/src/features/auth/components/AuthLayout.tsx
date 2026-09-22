import type { ReactNode } from 'react';
import { Brand } from '@/components/common/Brand';

export interface AuthLayoutProps {
  children: ReactNode;
  variant?: 'default' | 'register';
  /** Reserved for page copy; the shared donation illustration stays decorative. */
  visualTitle?: string;
  visualLead?: string;
  visualBullets?: readonly string[];
}

/** Reference 02 glass layout with a blood donation community illustration. */
export function AuthLayout({ children, variant = 'default' }: AuthLayoutProps) {
  return (
    <div className={`auth-layout auth-layout--${variant}`}>
      <header className="auth-scene-header">
        <Brand inverse tagline="Quản lý hiến máu" />
        <span className="auth-scene-header__message">
          Hiến máu hôm nay, trao cơ hội sống ngày mai.
        </span>
      </header>
      <main className="auth-form-panel__content">
        <div className="auth-form-panel">
          <div className="auth-form-container">{children}</div>
        </div>
      </main>
      <footer className="auth-form-panel__foot">
        © {new Date().getFullYear()} Blood Donation Management System
      </footer>
    </div>
  );
}

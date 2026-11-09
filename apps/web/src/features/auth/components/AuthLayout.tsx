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
      {/* Background ECG Heartbeat Line */}
      <div className="auth-heartbeat-bg" aria-hidden="true">
        <svg
          className="auth-heartbeat-svg"
          viewBox="0 0 1440 280"
          preserveAspectRatio="none"
        >
          <path
            className="auth-heartbeat-path"
            d="M0,140 L180,140 L210,140 L230,110 L245,170 L260,35 L285,245 L305,100 L325,160 L345,140 L700,140 L720,110 L735,170 L750,35 L775,245 L795,100 L815,160 L835,140 L1180,140 L1200,110 L1215,170 L1230,35 L1255,245 L1275,100 L1295,160 L1315,140 L1440,140"
          />
        </svg>
      </div>

      <header className="auth-scene-header">
        <Brand inverse tagline="Hệ thống Quản lý Hiến máu" />
        <span className="auth-scene-header__message">
          Mỗi giọt máu cho đi — Một cuộc đời ở lại
        </span>
      </header>
      <main className="auth-form-panel__content">
        <div className="auth-form-panel">
          <div className="auth-form-container">{children}</div>
        </div>
      </main>
      <footer className="auth-form-panel__foot">
        © {new Date().getFullYear()} Blood Donation Management System · Trao giọt máu, nối sự sống
      </footer>
    </div>
  );
}

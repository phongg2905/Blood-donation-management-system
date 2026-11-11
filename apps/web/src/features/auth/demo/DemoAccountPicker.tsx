import type { ReactNode } from 'react';
import { ClipboardList, Droplet, Shield, Stethoscope, User } from 'lucide-react';
import { DEMO_LOGIN_ACCOUNTS, DEMO_LOGIN_PASSWORD } from './demo-accounts';
import './demo-login.css';

const ROLE_ICONS: Record<string, ReactNode> = {
  SYSTEM_ADMIN: <Shield size={14} />,
  ADMIN: <Shield size={14} />,
  COORDINATOR: <ClipboardList size={14} />,
  DONATION_STAFF: <Stethoscope size={14} />,
  STAFF: <Stethoscope size={14} />,
  DONOR: <Droplet size={14} />,
};

export default function DemoAccountPicker({
  disabled,
  onSelect,
}: {
  disabled: boolean;
  onSelect: (credentials: { email: string; password: string }) => void;
}) {
  return (
    <div className="demo-login">
      <div className="demo-login__header">
        <span className="demo-login__title">Tài khoản mẫu (DEV):</span>
      </div>
      <div className="demo-login__choices">
        {DEMO_LOGIN_ACCOUNTS.map((account) => (
          <button
            type="button"
            key={account.email}
            className="demo-login__pill-btn"
            disabled={disabled}
            onClick={() =>
              onSelect({
                email: account.email,
                password: DEMO_LOGIN_PASSWORD,
              })
            }
          >
            <span className="demo-login__pill-icon" aria-hidden="true">
              {ROLE_ICONS[account.role] ?? <User size={14} />}
            </span>
            <span className="demo-login__pill-text">{account.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

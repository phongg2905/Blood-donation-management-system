import { useId, useState } from 'react';
import { ROLE_NAMES } from '@blood/shared-types';
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '../services/mock-auth.service';

export interface MockAccountsPanelProps {
  onSelect: (email: string, password: string) => void;
}

/**
 * Dev helper: compact collapsible panel with one-click sign-in for each role.
 *
 * Only rendered when `isMockAuthEnabled()` is true. Collapsed by default so it
 * does not dominate the login form. These are throwaway credentials for local
 * development — the file is deleted once the real auth API is integrated.
 */
export function MockAccountsPanel({ onSelect }: MockAccountsPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();

  return (
    <div className="mock-accounts-panel">
      <button
        type="button"
        className="mock-accounts-panel__header"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls={panelId}
      >
        <span>Demo accounts</span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <path d={expanded ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6'} />
        </svg>
      </button>

      <div
        id={panelId}
        className="mock-accounts-panel__body"
        hidden={!expanded}
      >
        <p className="mock-accounts-panel__lead">
          Mật khẩu chung: <code>{DEMO_PASSWORD}</code>
        </p>
        <div className="mock-accounts-panel__grid">
          {DEMO_ACCOUNTS.map((account) => (
            <button
              key={account.email}
              type="button"
              className="mock-accounts-panel__card"
              onClick={() => onSelect(account.email, account.password)}
              title={account.email}
            >
              <span className="mock-accounts-panel__identity">
                <span className="mock-accounts-panel__role">
                  {ROLE_NAMES[account.role]}
                </span>
                <span className="mock-accounts-panel__email">
                  {account.email}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

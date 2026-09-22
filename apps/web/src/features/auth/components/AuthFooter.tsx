import type { ReactNode } from 'react';

export interface AuthFooterProps {
  children: ReactNode;
}

/** Cross-links between the auth screens ("chưa có tài khoản?", "quay lại"). */
export function AuthFooter({ children }: AuthFooterProps) {
  return <footer className="auth-card__footer">{children}</footer>;
}

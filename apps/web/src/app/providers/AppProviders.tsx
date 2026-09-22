import type { ReactNode } from 'react';
import { AuthProvider } from '@/features/auth/context/AuthProvider';
import type { AuthService } from '@/features/auth/types';

export interface AppProvidersProps {
  children: ReactNode;
  /** Injectable auth data source; defaults to the mock/real resolver. */
  authService?: AuthService;
}

/**
 * Single place to compose app-wide providers.
 *
 * Phase 3+ providers (toast, query cache, …) wrap `children` here so `App.tsx`
 * and every test entry point stay unchanged.
 */
export function AppProviders({ children, authService }: AppProvidersProps) {
  return <AuthProvider service={authService}>{children}</AuthProvider>;
}

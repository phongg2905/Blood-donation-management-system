import type { AuthService } from '../types';
import { ApiAuthService } from './api-auth.service';
import { MockAuthService } from './mock-auth.service';

/**
 * Which data source the auth surface talks to.
 *
 * Pages never decide this — they receive an `AuthService` from `AuthProvider`,
 * which reads the resolved singleton here. Switching mock → real is a single
 * environment change plus finishing `ApiAuthService`.
 */
export interface AuthServiceConfig {
  useMock: boolean;
}

export const readAuthServiceConfig = (): AuthServiceConfig => ({
  // Defaults to mock so a checkout with no backend still runs; set
  // VITE_USE_MOCK_API=false to force the real adapter.
  useMock: import.meta.env.VITE_USE_MOCK_API === 'true',
});

export function createAuthService(
  config: AuthServiceConfig = readAuthServiceConfig(),
): AuthService {
  if (config.useMock && import.meta.env.PROD) {
    console.warn(
      '[auth] VITE_USE_MOCK_API is enabled in a production build — the app is running on mock data. See apps/web/TASK_UNTIL_AUTH_INTEGRATED.md.',
    );
  }
  return config.useMock ? new MockAuthService() : new ApiAuthService();
}

let instance: AuthService | null = null;

/** Process-wide auth service. */
export function getAuthService(): AuthService {
  instance ??= createAuthService();
  return instance;
}

/** True while the app is running on the mock adapter. */
export const isMockAuthEnabled = (): boolean => readAuthServiceConfig().useMock;

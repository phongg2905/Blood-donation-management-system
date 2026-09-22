import type { AuthService } from '../types';
import { ApiAuthService } from './api-auth.service';
import { MockAuthService } from './mock-auth.service';

/**
 * Which data source the auth surface talks to.
 *
 * Pages never decide this — they receive an `AuthService` from `AuthProvider`,
 * which reads the resolved singleton here. The backend adapter is the default;
 * mock data is opt-in for isolated UI work.
 */
export interface AuthServiceConfig {
  useMock: boolean;
}

export const readAuthServiceConfig = (): AuthServiceConfig => ({
  // Set this explicitly to `true` only when developing the UI without an API.
  useMock: import.meta.env.VITE_USE_MOCK_API === 'true',
});

export function createAuthService(
  config: AuthServiceConfig = readAuthServiceConfig(),
): AuthService {
  if (config.useMock && import.meta.env.PROD) {
    console.warn(
      '[auth] VITE_USE_MOCK_API is enabled in a production build — the app is running on mock data.',
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

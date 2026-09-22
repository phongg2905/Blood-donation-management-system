import { render } from '@testing-library/react';
import type { RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '@/features/auth/context/AuthProvider';
import { DEMO_PASSWORD } from '@/features/auth/services/mock-auth.service';
import type { AuthService } from '@/features/auth/types';

export interface RenderWithAuthOptions {
  service: AuthService;
  route?: string;
}

/** Renders `ui` inside `AuthProvider` + `MemoryRouter` at `route`. */
export function renderWithAuth(
  ui: ReactElement,
  { service, route = '/' }: RenderWithAuthOptions,
): RenderResult {
  return render(
    <AuthProvider service={service}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </AuthProvider>,
  );
}

/**
 * Seeds the mock adapter's session before rendering, so `AuthProvider`'s
 * bootstrap resolves an authenticated user.
 */
export async function signInAs(
  service: AuthService,
  email: string,
): Promise<void> {
  await service.login({ email, password: DEMO_PASSWORD });
}

import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAuth } from '../hooks/useAuth';
import {
  DEMO_PASSWORD,
  createMockAuthService,
} from '../services/mock-auth.service';
import { AuthProvider } from './AuthProvider';

function Probe() {
  const auth = useAuth();
  return (
    <div>
      <p data-testid="status">{auth.status}</p>
      <p data-testid="is-authenticated">{String(auth.isAuthenticated)}</p>
      <p data-testid="email">{auth.currentUser?.email ?? 'none'}</p>
      <p data-testid="fullname">{auth.currentUser?.fullName ?? 'none'}</p>
      <p data-testid="has-admin">{String(auth.hasRole('ADMIN'))}</p>
      <p data-testid="has-staff-role">
        {String(auth.hasRole('RECEPTION_STAFF', 'MEDICAL_STAFF'))}
      </p>
      <p data-testid="has-donation-start">
        {String(auth.hasPermission('donation.start'))}
      </p>
      <p data-testid="any-of">
        {String(auth.hasAnyPermission(['donation.start', 'screening.review']))}
      </p>
      <p data-testid="all-of">
        {String(auth.hasAllPermissions(['donation.start', 'screening.review']))}
      </p>
      <button
        type="button"
        onClick={() =>
          void auth.login({
            email: 'collection@example.local',
            password: DEMO_PASSWORD,
          })
        }
      >
        login-staff
      </button>
      <button type="button" onClick={() => void auth.logout()}>
        logout
      </button>
      <button
        type="button"
        onClick={() => void auth.updateProfile({ fullName: 'Tên Đã Đổi' })}
      >
        update
      </button>
    </div>
  );
}

const renderProbe = (latencyMs = 0) =>
  render(
    <AuthProvider service={createMockAuthService(latencyMs)}>
      <Probe />
    </AuthProvider>,
  );

describe('AuthProvider', () => {
  it('resolves to anonymous when there is no session', async () => {
    renderProbe();

    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('anonymous'),
    );
    expect(screen.getByTestId('is-authenticated')).toHaveTextContent('false');
    expect(screen.getByTestId('email')).toHaveTextContent('none');
  });

  it('reports the loading status during bootstrap', () => {
    renderProbe(50);
    expect(screen.getByTestId('status')).toHaveTextContent('loading');
  });

  it('signs in and exposes roles and permissions', async () => {
    const user = userEvent.setup();
    renderProbe();

    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('anonymous'),
    );

    await user.click(screen.getByRole('button', { name: 'login-staff' }));

    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('authenticated'),
    );
    expect(screen.getByTestId('is-authenticated')).toHaveTextContent('true');
    expect(screen.getByTestId('email')).toHaveTextContent(
      'collection@example.local',
    );

    // Roles and permissions come straight from the shared matrix.
    expect(screen.getByTestId('has-admin')).toHaveTextContent('false');
    // BLOOD_COLLECTION_STAFF is not one of the reception/medical roles.
    expect(screen.getByTestId('has-staff-role')).toHaveTextContent('false');
    expect(screen.getByTestId('has-donation-start')).toHaveTextContent('true');
    expect(screen.getByTestId('any-of')).toHaveTextContent('true');
    // BLOOD_COLLECTION_STAFF may start a donation but must not review screening.
    expect(screen.getByTestId('all-of')).toHaveTextContent('false');
  });

  it('clears the session on logout', async () => {
    const user = userEvent.setup();
    renderProbe();

    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('anonymous'),
    );
    await user.click(screen.getByRole('button', { name: 'login-staff' }));
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('authenticated'),
    );

    await user.click(screen.getByRole('button', { name: 'logout' }));

    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('anonymous'),
    );
    expect(screen.getByTestId('email')).toHaveTextContent('none');
  });

  it('reflects a profile update in currentUser', async () => {
    const user = userEvent.setup();
    renderProbe();

    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('anonymous'),
    );
    await user.click(screen.getByRole('button', { name: 'login-staff' }));
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('authenticated'),
    );

    await user.click(screen.getByRole('button', { name: 'update' }));

    await waitFor(() =>
      expect(screen.getByTestId('fullname')).toHaveTextContent('Tên Đã Đổi'),
    );
  });
});

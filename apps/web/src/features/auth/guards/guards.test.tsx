import { describe, expect, it } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { screen } from '@testing-library/react';
import type { PermissionCode } from '@blood/shared-types';
import { createMockAuthService } from '../services/mock-auth.service';
import { renderWithAuth, signInAs } from '@/test/render';
import { PermissionGuard } from './PermissionGuard';
import { ProtectedRoute } from './ProtectedRoute';

/** Anonymous app: `/secret` is behind ProtectedRoute, plus a `/login` marker. */
function ProtectedRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<p>trang-đăng-nhập</p>} />
      <Route element={<ProtectedRoute />}>
        <Route path="/secret" element={<p>nội-dung-bảo-vệ</p>} />
      </Route>
    </Routes>
  );
}

describe('ProtectedRoute', () => {
  it('redirects an anonymous visitor to /login', async () => {
    renderWithAuth(<ProtectedRoutes />, {
      service: createMockAuthService(),
      route: '/secret',
    });

    expect(await screen.findByText('trang-đăng-nhập')).toBeInTheDocument();
    expect(screen.queryByText('nội-dung-bảo-vệ')).not.toBeInTheDocument();
  });

  it('shows a loading state while the session is being restored', () => {
    renderWithAuth(<ProtectedRoutes />, {
      // Non-zero latency so the bootstrap is still pending on first paint.
      service: createMockAuthService(50),
      route: '/secret',
    });

    expect(screen.getByText('Đang tải…')).toBeInTheDocument();
  });

  it('renders the protected content for a signed-in user', async () => {
    const service = createMockAuthService();
    await signInAs(service, 'donor@example.local');

    renderWithAuth(<ProtectedRoutes />, { service, route: '/secret' });

    expect(await screen.findByText('nội-dung-bảo-vệ')).toBeInTheDocument();
  });
});

/** App where `/admin-only` requires `donation.start`. */
function GuardedRoutes({
  requiredPermission,
  anyOf,
  allOf,
  fallback,
}: {
  requiredPermission?: PermissionCode;
  anyOf?: readonly PermissionCode[];
  allOf?: readonly PermissionCode[];
  fallback?: string;
}) {
  return (
    <Routes>
      <Route path="/login" element={<p>trang-đăng-nhập</p>} />
      <Route path="/403" element={<p>trang-403</p>} />
      <Route
        path="/guarded"
        element={
          <PermissionGuard
            requiredPermission={requiredPermission}
            anyOf={anyOf}
            allOf={allOf}
            fallback={fallback ? <p>{fallback}</p> : undefined}
          >
            <p>nội-dung-có-quyền</p>
          </PermissionGuard>
        }
      />
    </Routes>
  );
}

describe('PermissionGuard', () => {
  it('redirects to /403 when the user lacks the permission', async () => {
    const service = createMockAuthService();
    await signInAs(service, 'donor@example.local'); // DONOR has no donation.start

    renderWithAuth(<GuardedRoutes requiredPermission="donation.start" />, {
      service,
      route: '/guarded',
    });

    expect(await screen.findByText('trang-403')).toBeInTheDocument();
    expect(screen.queryByText('nội-dung-có-quyền')).not.toBeInTheDocument();
  });

  it('lets DONATION_STAFF start a donation', async () => {
    const service = createMockAuthService();
    await signInAs(service, 'donation-staff@example.local'); // DONATION_STAFF

    renderWithAuth(<GuardedRoutes requiredPermission="donation.start" />, {
      service,
      route: '/guarded',
    });

    expect(await screen.findByText('nội-dung-có-quyền')).toBeInTheDocument();
  });

  it('lets DONATION_STAFF review a screening', async () => {
    const service = createMockAuthService();
    await signInAs(service, 'donation-staff@example.local');

    renderWithAuth(<GuardedRoutes requiredPermission="screening.review" />, {
      service,
      route: '/guarded',
    });

    expect(await screen.findByText('nội-dung-có-quyền')).toBeInTheDocument();
  });

  it('never lets SYSTEM_ADMIN (mapped from ADMIN) start a donation — not its duty', async () => {
    const service = createMockAuthService();
    await signInAs(service, 'admin@example.local');

    renderWithAuth(<GuardedRoutes requiredPermission="donation.start" />, {
      service,
      route: '/guarded',
    });

    expect(await screen.findByText('trang-403')).toBeInTheDocument();
  });

  it('treats SYSTEM_ADMIN as authorised for its own system-admin permissions', async () => {
    const service = createMockAuthService();
    await signInAs(service, 'admin@example.local');

    renderWithAuth(<GuardedRoutes requiredPermission="user.manage" />, {
      service,
      route: '/guarded',
    });

    expect(await screen.findByText('nội-dung-có-quyền')).toBeInTheDocument();
  });

  it('supports anyOf', async () => {
    const service = createMockAuthService();
    await signInAs(service, 'donation-staff@example.local');

    renderWithAuth(
      <GuardedRoutes anyOf={['donation.start', 'screening.review']} />,
      { service, route: '/guarded' },
    );

    expect(await screen.findByText('nội-dung-có-quyền')).toBeInTheDocument();
  });

  it('supports allOf and fails when only one is held', async () => {
    const service = createMockAuthService();
    await signInAs(service, 'donor@example.local'); // DONOR: registration.create only

    renderWithAuth(
      <GuardedRoutes allOf={['registration.create', 'donation.start']} />,
      { service, route: '/guarded' },
    );

    expect(await screen.findByText('trang-403')).toBeInTheDocument();
  });

  it('renders an inline fallback instead of redirecting when one is given', async () => {
    const service = createMockAuthService();
    await signInAs(service, 'donor@example.local');

    renderWithAuth(
      <GuardedRoutes
        requiredPermission="donation.start"
        fallback="không-có-quyền-inline"
      />,
      { service, route: '/guarded' },
    );

    expect(
      await screen.findByText('không-có-quyền-inline'),
    ).toBeInTheDocument();
    expect(screen.queryByText('trang-403')).not.toBeInTheDocument();
  });

  it('redirects an anonymous visitor to /login', async () => {
    renderWithAuth(<GuardedRoutes requiredPermission="donation.start" />, {
      service: createMockAuthService(),
      route: '/guarded',
    });

    expect(await screen.findByText('trang-đăng-nhập')).toBeInTheDocument();
  });
});

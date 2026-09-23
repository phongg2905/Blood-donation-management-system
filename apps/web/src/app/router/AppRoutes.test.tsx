import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { createMockAuthService } from '@/features/auth/services/mock-auth.service';
import { renderWithAuth, signInAs } from '@/test/render';
import { AppRoutes } from './AppRoutes';

const mount = (route: string, latencyMs = 0) =>
  renderWithAuth(<AppRoutes />, {
    service: createMockAuthService(latencyMs),
    route,
  });

describe('public routes', () => {
  it('renders the login screen', async () => {
    mount('/login');
    expect(
      await screen.findByRole('heading', { name: 'Đăng nhập hệ thống' }),
    ).toBeInTheDocument();
  });

  it('renders the register screen', async () => {
    mount('/register');
    expect(
      await screen.findByRole('heading', { name: 'Tạo tài khoản người hiến' }),
    ).toBeInTheDocument();
  });

  it('renders the forgot-password screen', async () => {
    mount('/forgot-password');
    expect(
      await screen.findByRole('heading', { name: 'Đặt lại mật khẩu' }),
    ).toBeInTheDocument();
  });

  it('renders the reset-password form when a token is present', async () => {
    mount('/reset-password?token=mock-reset-token');
    expect(
      await screen.findByRole('heading', { name: 'Mật khẩu mới' }),
    ).toBeInTheDocument();
  });

  it('reports a missing reset token instead of showing the form', async () => {
    mount('/reset-password');
    expect(
      await screen.findByText('Liên kết không dùng được'),
    ).toBeInTheDocument();
    // The password fields are gone: the token failure is terminal.
    expect(screen.queryByLabelText(/^Mật khẩu mới/)).not.toBeInTheDocument();
  });

  it('renders the 403 screen', async () => {
    mount('/403');
    expect(
      await screen.findByRole('heading', {
        name: 'Bạn không có quyền truy cập',
      }),
    ).toBeInTheDocument();
  });

  it('renders the 404 screen for an unknown route without exposing the path', async () => {
    mount('/khong-ton-tai');
    expect(
      await screen.findByRole('heading', { name: 'Không tìm thấy trang' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('/khong-ton-tai')).not.toBeInTheDocument();
  });

  it('does not expose the developer health screen', async () => {
    mount('/system-status');
    expect(
      await screen.findByRole('heading', { name: 'Không tìm thấy trang' }),
    ).toBeInTheDocument();
  });
});

describe('root redirect', () => {
  it('sends an anonymous visitor from / to /login', async () => {
    mount('/');
    expect(
      await screen.findByRole('heading', { name: 'Đăng nhập hệ thống' }),
    ).toBeInTheDocument();
  });

  it('sends a signed-in user from / to their landing page', async () => {
    const service = createMockAuthService();
    await signInAs(service, 'donor@example.local');

    renderWithAuth(<AppRoutes />, { service, route: '/' });

    expect(
      await screen.findByRole('heading', { name: /Trao một phần máu/ }),
    ).toBeInTheDocument();
  });
});

describe('protected route', () => {
  it('bounces an anonymous visitor to /login', async () => {
    mount('/profile');
    expect(
      await screen.findByRole('heading', { name: 'Đăng nhập hệ thống' }),
    ).toBeInTheDocument();
  });

  it('renders the profile for a signed-in donor', async () => {
    const service = createMockAuthService();
    await signInAs(service, 'donor@example.local');

    const { container } = renderWithAuth(<AppRoutes />, {
      service,
      route: '/profile',
    });

    expect(
      await screen.findByRole('heading', { name: 'Thông tin cá nhân' }),
    ).toBeInTheDocument();
    expect(container.querySelector('.app-shell--donor')).not.toBeNull();
  });
});

describe('role-based shell', () => {
  it('uses the staff shell for the three staff roles', async () => {
    const service = createMockAuthService();
    await signInAs(service, 'medical@example.local');

    const { container } = renderWithAuth(<AppRoutes />, {
      service,
      route: '/profile',
    });

    expect(
      await screen.findByRole('heading', { name: 'Thông tin cá nhân' }),
    ).toBeInTheDocument();
    expect(container.querySelector('.app-shell--staff')).not.toBeNull();
    // The session block shows the role name, proving the right user is rendered.
    expect(container.querySelector('.session__role')?.textContent).toBe(
      'Nhân viên y tế',
    );
  });

  it('uses the admin shell for ADMIN', async () => {
    const service = createMockAuthService();
    await signInAs(service, 'admin@example.local');

    const { container } = renderWithAuth(<AppRoutes />, {
      service,
      route: '/profile',
    });

    await screen.findByRole('heading', { name: 'Thông tin cá nhân' });
    expect(container.querySelector('.app-shell--admin')).not.toBeNull();
    expect(container.querySelector('.session__role')?.textContent).toBe(
      'Quản trị viên',
    );
  });
});

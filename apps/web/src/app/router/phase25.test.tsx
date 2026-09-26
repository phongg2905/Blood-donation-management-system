import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiRequestError } from '@/services/api';
import {
  createMockAuthService,
  DEMO_PASSWORD,
} from '@/features/auth/services/mock-auth.service';
import { renderWithAuth, signInAs } from '@/test/render';
import { AppRoutes } from './AppRoutes';

async function mountProfile() {
  const service = createMockAuthService();
  await signInAs(service, 'donor@example.local');
  const original = await service.getCurrentUser();
  const rendered = renderWithAuth(<AppRoutes />, {
    service,
    route: '/profile',
  });
  await screen.findByRole('heading', { name: 'Thông tin cá nhân' });
  return { service, original: original!, ...rendered };
}

describe('Phase 2.5 profile', () => {
  it('starts read-only, removes technical data, and discards drafts on cancel', async () => {
    const user = userEvent.setup();
    const { service, original, container } = await mountProfile();
    const save = vi.spyOn(service, 'updateProfile');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    for (const permission of original.permissions)
      expect(container).not.toHaveTextContent(permission);
    expect(container).not.toHaveTextContent(original.id);
    expect(screen.queryByText('Trạng thái hệ thống')).not.toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'Chỉnh sửa thông tin' }),
    );
    expect(screen.getByLabelText(/^Email/)).toHaveAttribute('readonly');
    const name = screen.getByLabelText(/^Họ và tên/);
    expect(name).toHaveFocus();
    await user.clear(name);
    await user.type(name, 'Bản nháp');
    await user.click(screen.getByRole('button', { name: 'Hủy' }));
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();
    expect(
      screen.getByRole('button', { name: 'Chỉnh sửa thông tin' }),
    ).toHaveFocus();
    await user.click(
      screen.getByRole('button', { name: 'Chỉnh sửa thông tin' }),
    );
    expect(screen.getByLabelText(/^Họ và tên/)).toHaveValue(original.fullName);
  });

  it('keeps a failed draft editable and hides internal errors', async () => {
    const user = userEvent.setup();
    const { service } = await mountProfile();
    vi.spyOn(service, 'updateProfile').mockRejectedValue(
      new ApiRequestError(
        'INTERNAL_ERROR',
        'Prisma database query failed',
        500,
      ),
    );
    await user.click(
      screen.getByRole('button', { name: 'Chỉnh sửa thông tin' }),
    );
    await user.type(screen.getByLabelText(/^Số điện thoại/), '0901234567');
    await user.type(screen.getByLabelText(/^Địa chỉ/), 'Hà Nội');
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Chưa thể hoàn tất yêu cầu',
    );
    expect(screen.queryByText(/Prisma|INTERNAL_ERROR/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^Địa chỉ/)).toHaveValue('Hà Nội');
    expect(screen.getByRole('button', { name: 'Hủy' })).toBeEnabled();
  });

  it('disables save and cancel during a pending update and exits after success', async () => {
    const user = userEvent.setup();
    const { service, original } = await mountProfile();
    let finish!: (value: typeof original) => void;
    vi.spyOn(service, 'updateProfile').mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Chỉnh sửa thông tin' }),
    );
    await user.type(screen.getByLabelText(/^Số điện thoại/), '0901234567');
    await user.type(screen.getByLabelText(/^Địa chỉ/), 'Hà Nội');
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    expect(screen.getByRole('button', { name: 'Đang lưu…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Hủy' })).toBeDisabled();
    await act(async () => {
      finish({
        ...original,
        fullName: 'Tên đã lưu',
        phone: '0901234567',
        address: 'Hà Nội',
      });
    });
    expect(
      await screen.findByText('Thông tin cá nhân đã được cập nhật.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Tên đã lưu' }),
    ).toBeInTheDocument();
  });

  it('does not offer editing without the update permission', async () => {
    const service = createMockAuthService();
    await signInAs(service, 'donor@example.local');
    const original = (await service.getCurrentUser())!;
    vi.spyOn(service, 'getCurrentUser').mockResolvedValue({
      ...original,
      permissions: ['auth.profile.read'],
    });
    renderWithAuth(<AppRoutes />, { service, route: '/profile' });
    await screen.findByRole('heading', { name: 'Thông tin cá nhân' });
    expect(
      screen.queryByRole('button', { name: 'Chỉnh sửa thông tin' }),
    ).not.toBeInTheDocument();
  });
});

describe('Phase 2.5 home and session', () => {
  it.each(['/login', '/register', '/'])(
    'restores a signed-in session at %s onto home',
    async (route) => {
      const service = createMockAuthService();
      await signInAs(service, 'donor@example.local');
      renderWithAuth(<AppRoutes />, { service, route });
      expect(
        await screen.findByRole('heading', { name: /Trao một phần máu/ }),
      ).toBeInTheDocument();
      expect(
        screen.getAllByRole('button', { name: 'Đăng ký hiến máu' }),
      ).toHaveLength(1);
      for (const button of screen.getAllByRole('button', {
        name: 'Đăng ký hiến máu',
      }))
        expect(button).toBeDisabled();
      expect(
        screen.queryByText(/Quyền được cấp|Trạng thái hệ thống/),
      ).not.toBeInTheDocument();
    },
  );

  it('hides unavailable actions by permission and still allows home', async () => {
    const service = createMockAuthService();
    await signInAs(service, 'donor@example.local');
    const original = (await service.getCurrentUser())!;
    vi.spyOn(service, 'getCurrentUser').mockResolvedValue({
      ...original,
      permissions: [],
    });
    renderWithAuth(<AppRoutes />, { service, route: '/' });
    await screen.findByRole('heading', { name: /Trao một phần máu/ });
    expect(
      screen.queryByRole('button', { name: 'Đăng ký hiến máu' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /Hồ sơ|Đợt hiến máu/i }),
    ).not.toBeInTheDocument();
  });

  it('preserves the intended protected destination after login', async () => {
    const user = userEvent.setup();
    renderWithAuth(<AppRoutes />, {
      service: createMockAuthService(),
      route: '/profile',
    });
    await user.type(
      await screen.findByLabelText(/^Email/),
      'donor@example.local',
    );
    await user.type(screen.getByLabelText(/^Mật khẩu/), DEMO_PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    expect(
      await screen.findByRole('heading', { name: 'Thông tin cá nhân' }),
    ).toBeInTheDocument();
  });

  it('logs out from the account menu and protects home again', async () => {
    const user = userEvent.setup();
    const service = createMockAuthService();
    await signInAs(service, 'donor@example.local');
    renderWithAuth(<AppRoutes />, { service, route: '/' });
    await screen.findByRole('heading', { name: /Trao một phần máu/ });
    await user.click(screen.getByLabelText('Tài khoản của bạn'));
    await user.click(screen.getByRole('button', { name: 'Đăng xuất' }));
    expect(
      await screen.findByRole('heading', { name: 'Đăng nhập hệ thống' }),
    ).toBeInTheDocument();
    await waitFor(async () =>
      expect(await service.getCurrentUser()).toBeNull(),
    );
  });

  it('does not send the next user to the page the previous one signed out from', async () => {
    const user = userEvent.setup();
    const service = createMockAuthService();
    await signInAs(service, 'donation-staff@example.local');
    renderWithAuth(<AppRoutes />, { service, route: '/clinic/blood-bags' });
    await screen.findByRole('heading', { name: 'Túi máu đã tiếp nhận' });
    await user.click(screen.getByLabelText('Tài khoản của bạn'));
    await user.click(screen.getByRole('button', { name: 'Đăng xuất' }));
    await screen.findByRole('heading', { name: 'Đăng nhập hệ thống' });

    // COORDINATOR has no `bloodbag.read`, so honouring the stale `from` would
    // bounce this sign-in to /403 instead of its own landing page.
    await user.type(
      screen.getByLabelText(/^Email/),
      'coordinator@example.local',
    );
    await user.type(screen.getByLabelText(/^Mật khẩu/), DEMO_PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    expect(
      await screen.findByRole('heading', { name: /Trao một phần máu/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Túi máu đã tiếp nhận' }),
    ).not.toBeInTheDocument();
  });

  it('does not render a development reset token returned by the API', async () => {
    const user = userEvent.setup();
    const service = createMockAuthService();
    vi.spyOn(service, 'forgotPassword').mockResolvedValue({
      message: 'OK',
      devResetToken: 'private-reset-token',
    });
    const { container } = renderWithAuth(<AppRoutes />, {
      service,
      route: '/forgot-password',
    });
    await user.type(
      await screen.findByLabelText(/^Email/),
      'donor@example.local',
    );
    await user.click(
      screen.getByRole('button', { name: 'Gửi liên kết đặt lại' }),
    );
    await screen.findByText('Đã gửi yêu cầu');
    expect(container.innerHTML).not.toContain('private-reset-token');
    expect(screen.queryByText(/môi trường phát triển/)).not.toBeInTheDocument();
  });
});

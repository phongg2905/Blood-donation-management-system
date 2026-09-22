import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppRoutes } from '@/app/router/AppRoutes';
import { renderWithAuth } from '@/test/render';
import { ApiRequestError } from '@/services/api';
import {
  DEMO_PASSWORD,
  createMockAuthService,
} from '../services/mock-auth.service';

const mountLogin = () =>
  renderWithAuth(<AppRoutes />, {
    service: createMockAuthService(),
    route: '/login',
  });

describe('LoginPage', () => {
  it('shows validation errors instead of calling the API', async () => {
    const user = userEvent.setup();
    mountLogin();

    await user.click(await screen.findByRole('button', { name: 'Đăng nhập' }));

    expect(screen.getByText('Vui lòng nhập email.')).toBeInTheDocument();
    expect(screen.getByText('Vui lòng nhập mật khẩu.')).toBeInTheDocument();
  });

  it('rejects a malformed email', async () => {
    const user = userEvent.setup();
    mountLogin();

    await user.type(await screen.findByLabelText(/^Email/), 'khong-phai-email');
    await user.type(screen.getByLabelText(/^Mật khẩu/), DEMO_PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(screen.getByText('Email không hợp lệ.')).toBeInTheDocument();
  });

  it('shows a credentials error for a wrong password', async () => {
    const user = userEvent.setup();
    mountLogin();

    await user.type(
      await screen.findByLabelText(/^Email/),
      'donor@example.local',
    );
    await user.type(screen.getByLabelText(/^Mật khẩu/), 'sai-mat-khau');
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(
      await screen.findByText('Email hoặc mật khẩu không đúng.'),
    ).toBeInTheDocument();
  });

  it('shows an inactive-account error with its own copy', async () => {
    const user = userEvent.setup();
    mountLogin();

    await user.type(
      await screen.findByLabelText(/^Email/),
      'inactive@example.local',
    );
    await user.type(screen.getByLabelText(/^Mật khẩu/), DEMO_PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(
      await screen.findByText(/Tài khoản đã bị vô hiệu hoá/),
    ).toBeInTheDocument();
  });

  it('signs a donor in and lands on the profile page', async () => {
    const user = userEvent.setup();
    const { container } = mountLogin();
    await user.type(
      await screen.findByLabelText(/^Email/),
      'donor@example.local',
    );
    await user.type(screen.getByLabelText(/^Mật khẩu/), DEMO_PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(
      await screen.findByRole('heading', { name: 'Thông tin cá nhân' }),
    ).toBeInTheDocument();
    expect(container.querySelector('.session__role')?.textContent).toBe(
      'Người hiến máu',
    );
  });

  it('signs an admin in and shows the admin role', async () => {
    const user = userEvent.setup();
    const { container } = mountLogin();
    await user.type(
      await screen.findByLabelText(/^Email/),
      'admin@example.local',
    );
    await user.type(screen.getByLabelText(/^Mật khẩu/), DEMO_PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(
      await screen.findByRole('heading', { name: 'Thông tin cá nhân' }),
    ).toBeInTheDocument();
    expect(container.querySelector('.session__role')?.textContent).toBe(
      'Quản trị viên',
    );
  });
});

describe('RegisterPage', () => {
  it('offers no role selector — public registration is donor-only', async () => {
    renderWithAuth(<AppRoutes />, {
      service: createMockAuthService(),
      route: '/register',
    });

    expect(
      await screen.findByRole('heading', { name: 'Tạo tài khoản người hiến' }),
    ).toBeInTheDocument();
    // No dropdown/select of any kind, and no role field.
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/vai trò/i)).not.toBeInTheDocument();
  });

  it('validates the password confirmation and the terms checkbox', async () => {
    const user = userEvent.setup();
    renderWithAuth(<AppRoutes />, {
      service: createMockAuthService(),
      route: '/register',
    });

    await user.type(await screen.findByLabelText(/^Họ và tên/), 'Nguyễn Văn A');
    await user.type(screen.getByLabelText(/^Email/), 'moi@example.local');
    await user.type(screen.getByLabelText(/^Mật khẩu/), DEMO_PASSWORD);
    await user.type(screen.getByLabelText(/^Nhập lại mật khẩu/), 'Khac@123');
    await user.click(screen.getByRole('button', { name: 'Tạo tài khoản' }));

    expect(
      screen.getByText('Mật khẩu nhập lại không khớp.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Bạn cần đồng ý với điều khoản sử dụng.'),
    ).toBeInTheDocument();
  });

  it('registers a donor and signs the new user in', async () => {
    const user = userEvent.setup();
    renderWithAuth(<AppRoutes />, {
      service: createMockAuthService(),
      route: '/register',
    });

    await user.type(await screen.findByLabelText(/^Họ và tên/), 'Nguyễn Văn A');
    await user.type(screen.getByLabelText(/^Email/), 'moi@example.local');
    await user.type(screen.getByLabelText(/^Mật khẩu/), DEMO_PASSWORD);
    await user.type(screen.getByLabelText(/^Nhập lại mật khẩu/), DEMO_PASSWORD);
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Tạo tài khoản' }));

    expect(
      await screen.findByRole('heading', { name: 'Thông tin cá nhân' }),
    ).toBeInTheDocument();
  });

  it('reports a duplicate email', async () => {
    const user = userEvent.setup();
    renderWithAuth(<AppRoutes />, {
      service: createMockAuthService(),
      route: '/register',
    });

    await user.type(await screen.findByLabelText(/^Họ và tên/), 'Nguyễn Văn A');
    await user.type(screen.getByLabelText(/^Email/), 'donor@example.local');
    await user.type(screen.getByLabelText(/^Mật khẩu/), DEMO_PASSWORD);
    await user.type(screen.getByLabelText(/^Nhập lại mật khẩu/), DEMO_PASSWORD);
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Tạo tài khoản' }));

    // Shown twice on purpose: on the email field and in the form banner.
    const matches = await screen.findAllByText('Email này đã được đăng ký.');
    expect(matches.length).toBeGreaterThan(0);
  });
});

describe('ForgotPasswordPage', () => {
  it('shows the success state after submitting an email', async () => {
    const user = userEvent.setup();
    renderWithAuth(<AppRoutes />, {
      service: createMockAuthService(),
      route: '/forgot-password',
    });

    await user.type(
      await screen.findByLabelText(/^Email/),
      'donor@example.local',
    );
    await user.click(
      screen.getByRole('button', { name: 'Gửi liên kết đặt lại' }),
    );

    expect(await screen.findByText('Đã gửi yêu cầu')).toBeInTheDocument();
  });
});

describe('ResetPasswordPage', () => {
  it('shows backend newPassword validation errors on the password input', async () => {
    const user = userEvent.setup();
    const service = createMockAuthService();
    vi.spyOn(service, 'resetPassword').mockRejectedValue(
      new ApiRequestError('VALIDATION_ERROR', 'Dữ liệu không hợp lệ', 400, {
        newPassword: 'Mật khẩu không được chấp nhận',
      }),
    );
    renderWithAuth(<AppRoutes />, {
      service,
      route: '/reset-password?token=reset-token',
    });

    const password = await screen.findByLabelText(/^Mật khẩu mới/);
    await user.type(password, DEMO_PASSWORD);
    await user.type(
      screen.getByLabelText(/^Nhập lại mật khẩu mới/),
      DEMO_PASSWORD,
    );
    await user.click(screen.getByRole('button', { name: 'Đặt lại mật khẩu' }));

    expect(
      await screen.findByText('Mật khẩu không được chấp nhận'),
    ).toBeInTheDocument();
    expect(password).toHaveAttribute('aria-invalid', 'true');
  });

  it('reports an expired token', async () => {
    const user = userEvent.setup();
    renderWithAuth(<AppRoutes />, {
      service: createMockAuthService(),
      route: '/reset-password?token=mock-reset-expired',
    });

    await user.type(
      await screen.findByLabelText(/^Mật khẩu mới/),
      DEMO_PASSWORD,
    );
    await user.type(
      screen.getByLabelText(/^Nhập lại mật khẩu mới/),
      DEMO_PASSWORD,
    );
    await user.click(screen.getByRole('button', { name: 'Đặt lại mật khẩu' }));

    expect(
      await screen.findByText(/Liên kết đặt lại mật khẩu đã hết hạn/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Đặt lại mật khẩu' }),
    ).not.toBeInTheDocument();
  });

  it('resets the password for a valid token', async () => {
    const user = userEvent.setup();
    renderWithAuth(<AppRoutes />, {
      service: createMockAuthService(),
      route: '/reset-password?token=mock-reset-token',
    });

    await user.type(
      await screen.findByLabelText(/^Mật khẩu mới/),
      DEMO_PASSWORD,
    );
    await user.type(
      screen.getByLabelText(/^Nhập lại mật khẩu mới/),
      DEMO_PASSWORD,
    );
    await user.click(screen.getByRole('button', { name: 'Đặt lại mật khẩu' }));

    expect(
      await screen.findByText('Đặt lại mật khẩu thành công'),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Mật khẩu mới/)).not.toBeInTheDocument();
  });
});

describe('ProfilePage with the delivered backend contract', () => {
  it('edits only the full name when CurrentUser has no contact fields', async () => {
    const user = userEvent.setup();
    const service = createMockAuthService();
    await service.login({
      email: 'reception@example.local',
      password: DEMO_PASSWORD,
    });
    const save = vi.spyOn(service, 'updateProfile');
    renderWithAuth(<AppRoutes />, { service, route: '/profile' });

    const fullName = await screen.findByLabelText(/^Họ và tên/);
    expect(screen.queryByLabelText('Số điện thoại')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Địa chỉ')).not.toBeInTheDocument();
    await user.clear(fullName);
    await user.type(fullName, 'Tên mới');
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));

    expect(
      await screen.findByText('Thông tin cá nhân đã được cập nhật.'),
    ).toBeInTheDocument();
    expect(save).toHaveBeenCalledWith({ fullName: 'Tên mới' });
    const saved = await service.getCurrentUser();
    expect(saved).toMatchObject({ fullName: 'Tên mới' });
    // STAFF/ADMIN must never carry contact fields.
    expect(saved).not.toHaveProperty('phone');
  });

  it('edits fullName, phone and address for a DONOR and reads them back', async () => {
    const user = userEvent.setup();
    const service = createMockAuthService();
    await service.login({
      email: 'donor@example.local',
      password: DEMO_PASSWORD,
    });
    const save = vi.spyOn(service, 'updateProfile');
    renderWithAuth(<AppRoutes />, { service, route: '/profile' });

    expect(
      await screen.findByLabelText(/^Số điện thoại/),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/^Địa chỉ/)).toBeInTheDocument();

    await user.clear(await screen.findByLabelText(/^Họ và tên/));
    await user.type(screen.getByLabelText(/^Họ và tên/), 'Donor Đã Đổi');
    await user.clear(screen.getByLabelText(/^Số điện thoại/));
    await user.type(screen.getByLabelText(/^Số điện thoại/), '0901234567');
    await user.clear(screen.getByLabelText(/^Địa chỉ/));
    await user.type(screen.getByLabelText(/^Địa chỉ/), '123 Đường ABC, Quận 1');
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));

    expect(
      await screen.findByText('Thông tin cá nhân đã được cập nhật.'),
    ).toBeInTheDocument();
    expect(save).toHaveBeenCalledWith({
      fullName: 'Donor Đã Đổi',
      phone: '0901234567',
      address: '123 Đường ABC, Quận 1',
    });
    const saved = await service.getCurrentUser();
    expect(saved).toMatchObject({
      fullName: 'Donor Đã Đổi',
      phone: '0901234567',
      address: '123 Đường ABC, Quận 1',
    });
  });

  it('shows contact validation errors without calling the service', async () => {
    const user = userEvent.setup();
    const service = createMockAuthService();
    await service.login({
      email: 'donor@example.local',
      password: DEMO_PASSWORD,
    });
    const save = vi.spyOn(service, 'updateProfile');
    renderWithAuth(<AppRoutes />, { service, route: '/profile' });

    await user.clear(await screen.findByLabelText(/^Số điện thoại/));
    await user.type(screen.getByLabelText(/^Số điện thoại/), '123');
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));

    expect(
      await screen.findByText(/Số điện thoại phải có 8–20 ký tự/),
    ).toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();
  });
});

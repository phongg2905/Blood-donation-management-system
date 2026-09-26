import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it } from 'vitest';
import { AppRoutes } from '@/app/router/AppRoutes';
import { createMockAuthService } from '@/features/auth/services/mock-auth.service';
import { renderWithAuth, signInAs } from '@/test/render';
import { AdminRepositoryContext } from './repository';
import { MockAdminRepository } from './mock-repository';
import { validateSettingValue } from './domain';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
});

async function mount(route: string, email = 'admin@example.local') {
  const auth = createMockAuthService();
  await signInAs(auth, email);
  const repository = new MockAdminRepository({ latency: 0 });
  const rendered = renderWithAuth(
    <AdminRepositoryContext.Provider value={repository}>
      <AppRoutes />
    </AdminRepositoryContext.Provider>,
    { service: auth, route },
  );
  return { ...rendered, repository, user: userEvent.setup() };
}

describe('Admin access control', () => {
  it('blocks a non-admin from every administration route', async () => {
    await mount('/admin/users', 'donor@example.local');
    expect(
      await screen.findByRole('heading', { name: /không có quyền/i }),
    ).toBeInTheDocument();
  });

  it('shows the administration navigation to a system admin', async () => {
    await mount('/admin/users');
    await screen.findByRole('heading', { name: 'Người dùng' });
    expect(
      await screen.findByRole('link', { name: 'Nhật ký' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Sàng lọc' }),
    ).not.toBeInTheDocument();
  });
});

describe('Users', () => {
  it('lists accounts, filters them and edits an account', async () => {
    const { user } = await mount('/admin/users');
    expect(
      await screen.findByText('donor.demo@example.local'),
    ).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Vai trò'), 'COORDINATOR');
    expect(await screen.findByText('Coordinator Demo')).toBeInTheDocument();
    expect(
      screen.queryByText('donor.demo@example.local'),
    ).not.toBeInTheDocument();

    const row = screen.getByText('Coordinator Demo').closest('tr')!;
    await user.click(within(row).getByRole('button', { name: 'Sửa' }));
    const name = screen.getByLabelText(/^Họ và tên/);
    await user.clear(name);
    await user.type(name, 'Điều phối viên A');
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    expect(
      await screen.findByText('Đã cập nhật tài khoản.'),
    ).toBeInTheDocument();
    expect(await screen.findByText('Điều phối viên A')).toBeInTheDocument();
  });

  it('validates the name before saving', async () => {
    const { user } = await mount('/admin/users');
    const row = (await screen.findByText('Donor Demo')).closest('tr')!;
    await user.click(within(row).getByRole('button', { name: 'Sửa' }));
    await user.clear(screen.getByLabelText(/^Họ và tên/));
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    expect(
      await screen.findByText('Nhập họ tên từ 1 đến 200 ký tự.'),
    ).toBeInTheDocument();
  });

  it('assigns roles from the shared four-actor catalogue', async () => {
    const { user } = await mount('/admin/users');
    const row = (await screen.findByText('Donor Demo')).closest('tr')!;
    await user.click(within(row).getByRole('button', { name: 'Phân quyền' }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByLabelText('Điều phối viên'));
    await user.click(
      within(dialog).getByRole('button', { name: 'Lưu thay đổi' }),
    );
    expect(await screen.findByText('Đã cập nhật vai trò.')).toBeInTheDocument();
  });
});

describe('Roles and permissions', () => {
  it('shows all four roles with their matrix permissions', async () => {
    await mount('/admin/roles');
    expect(
      await screen.findByRole('heading', { name: 'Người hiến máu' }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', {
        name: 'Nhân viên tiếp nhận / sàng lọc',
      }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { name: 'Quản trị hệ thống' }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('registration.checkin').length).toBeGreaterThan(
      0,
    );
  });
});

describe('Audit log', () => {
  it('filters entries by action', async () => {
    const { user } = await mount('/admin/audit-logs');
    // Scope to the table: the same labels also appear as filter options.
    const table = await screen.findByRole('table');
    expect(within(table).getByText('Đăng nhập thành công')).toBeInTheDocument();
    await user.selectOptions(
      screen.getByLabelText('Hành động'),
      'LOGIN_FAILED',
    );
    const filtered = await screen.findByRole('table');
    expect(
      within(filtered).getByText('Đăng nhập thất bại'),
    ).toBeInTheDocument();
    expect(
      within(filtered).queryByText('Đăng nhập thành công'),
    ).not.toBeInTheDocument();
  });
});

describe('Settings', () => {
  it('updates a value and rejects an invalid one', async () => {
    const { user } = await mount('/admin/settings');
    const row = (await screen.findByText('registration.advance_days')).closest(
      'tr',
    )!;
    await user.click(within(row).getByRole('button', { name: 'Sửa' }));
    const input = within(row).getByLabelText(
      'Giá trị của registration.advance_days',
    );
    await user.clear(input);
    await user.type(input, 'không phải số');
    await user.click(within(row).getByRole('button', { name: 'Lưu' }));
    expect(
      await screen.findByText('Giá trị phải là một số.'),
    ).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, '45');
    await user.click(within(row).getByRole('button', { name: 'Lưu' }));
    expect(
      await screen.findByText('Đã lưu cấu hình "registration.advance_days".'),
    ).toBeInTheDocument();
  });

  it('validates setting values by declared type', () => {
    expect(validateSettingValue('', 'STRING')).toMatch(/không được để trống/);
    expect(validateSettingValue('abc', 'NUMBER')).toMatch(/phải là một số/);
    expect(validateSettingValue('yes', 'BOOLEAN')).toMatch(/true hoặc false/);
    expect(validateSettingValue('{oops', 'JSON')).toMatch(/JSON hợp lệ/);
    expect(validateSettingValue('42', 'NUMBER')).toBeNull();
  });
});

describe('Reports', () => {
  it('renders rows with totals and exports CSV', async () => {
    const { user } = await mount('/admin/reports');
    // The campaign name is also a filter option, so assert inside the table.
    const table = await screen.findByRole('table');
    expect(within(table).getByText('Ngày hội giọt hồng')).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /^Tổng/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Xuất CSV' }));
    expect(await screen.findByText('Đã tạo tệp báo cáo.')).toBeInTheDocument();
  });
});

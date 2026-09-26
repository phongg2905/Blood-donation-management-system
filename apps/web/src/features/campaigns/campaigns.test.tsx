import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '@/app/router/AppRoutes';
import { createMockAuthService } from '@/features/auth/services/mock-auth.service';
import { renderWithAuth, signInAs } from '@/test/render';
import { ApiRequestError } from '@/services/api';
import { CampaignRepositoryContext } from './repository';
import { MockCampaignRepository } from './mock-repository';
import { validateCampaign, validateSlot, canAct } from './domain';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
});
async function mount(
  route = '/campaigns',
  manager = false,
  repository = new MockCampaignRepository({ latency: 0 }),
) {
  const auth = createMockAuthService();
  // Campaign management belongs to COORDINATOR in the four-actor model.
  await signInAs(
    auth,
    manager ? 'coordinator@example.local' : 'donor@example.local',
  );
  const rendered = renderWithAuth(
    <CampaignRepositoryContext.Provider value={repository}>
      <AppRoutes />
    </CampaignRepositoryContext.Provider>,
    { service: auth, route },
  );
  return { ...rendered, repository, user: userEvent.setup() };
}
describe('Campaign browsing and permissions', () => {
  it('loads, searches through URL filters, and hides donor management actions', async () => {
    const { user } = await mount();
    expect(
      await screen.findByRole('heading', { name: 'Ngày hội giọt hồng' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Tạo đợt hiến' }),
    ).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Tìm kiếm'), 'không có kết quả');
    expect(
      await screen.findByRole('heading', {
        name: 'Chưa có đợt hiến máu phù hợp.',
      }),
    ).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Xóa bộ lọc' })[0]!);
    expect(
      await screen.findByRole('heading', { name: 'Ngày hội giọt hồng' }),
    ).toBeInTheDocument();
  });
  it('shows loading then a friendly error and supports retry', async () => {
    const repository = new MockCampaignRepository({ latency: 0 });
    let reject!: (error: unknown) => void;
    vi.spyOn(repository, 'list').mockImplementationOnce(
      () =>
        new Promise((_, fail) => {
          reject = fail;
        }),
    );
    const { user } = await mount('/campaigns', false, repository);
    expect(
      await screen.findByLabelText('Đang tải dữ liệu'),
    ).toBeInTheDocument();
    await act(async () =>
      reject(new ApiRequestError('INTERNAL_ERROR', 'database secret', 500)),
    );
    expect(await screen.findByRole('alert')).not.toHaveTextContent(
      'database secret',
    );
    await user.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(
      await screen.findByRole('heading', { name: 'Ngày hội giọt hồng' }),
    ).toBeInTheDocument();
  });
  it('renders an empty repository', async () => {
    await mount(
      '/campaigns',
      false,
      new MockCampaignRepository({ latency: 0, scenario: 'empty' }),
    );
    expect(
      await screen.findByText('Chưa có đợt hiến máu phù hợp.'),
    ).toBeInTheDocument();
  });
  it.each([
    '/campaigns/new',
    '/campaigns/demo-1/edit',
    '/campaigns/demo-1/staff',
  ])('guards direct management route %s', async (route) => {
    await mount(route);
    expect(
      await screen.findByRole('heading', { name: /không có quyền/i }),
    ).toBeInTheDocument();
  });
  it('does not expose staff or editing to donors on detail', async () => {
    await mount('/campaigns/demo-1');
    await screen.findByRole('heading', { name: 'Thông tin đợt hiến' });
    expect(
      screen.queryByRole('link', { name: 'Nhân sự đợt hiến' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Chỉnh sửa' }),
    ).not.toBeInTheDocument();
    // Registration is reached from the campaign itself, not a duplicate menu.
    expect(
      screen.getByRole('link', { name: 'Đăng ký hiến máu' }),
    ).toHaveAttribute('href', '/donor/register?campaign=demo-1');
  });

  it('offers the register action only on open campaigns', async () => {
    await mount('/campaigns');
    const openRow = (
      await screen.findByRole('heading', { name: 'Ngày hội giọt hồng' })
    ).closest('article');
    expect(
      within(openRow as HTMLElement).getByRole('link', {
        name: 'Đăng ký hiến máu',
      }),
    ).toHaveAttribute('href', '/donor/register?campaign=demo-1');
    const closedRow = (
      await screen.findByRole('heading', { name: 'Sẻ chia sự sống' })
    ).closest('article');
    expect(
      within(closedRow as HTMLElement).queryByRole('link', {
        name: 'Đăng ký hiến máu',
      }),
    ).not.toBeInTheDocument();
  });

  it('does not offer the register action to campaign managers', async () => {
    await mount('/campaigns/demo-1', true);
    await screen.findByRole('heading', { name: 'Thông tin đợt hiến' });
    expect(
      screen.queryByRole('link', { name: 'Đăng ký hiến máu' }),
    ).not.toBeInTheDocument();
  });
});
describe('Campaign forms and actions', () => {
  it('validates required fields then creates a draft and opens detail', async () => {
    const { user, repository } = await mount('/campaigns/new', true);
    await user.click(
      await screen.findByRole('button', { name: 'Tạo bản nháp' }),
    );
    expect(screen.getByLabelText(/Tên đợt hiến máu/)).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    await user.type(
      screen.getByLabelText(/Tên đợt hiến máu/),
      'Đợt hiến thử nghiệm',
    );
    await user.type(screen.getByLabelText(/Địa điểm/), 'Trung tâm cộng đồng');
    fireEvent.change(screen.getByLabelText(/Bắt đầu đợt hiến/), {
      target: { value: '2026-10-20T08:00' },
    });
    fireEvent.change(screen.getByLabelText(/Kết thúc đợt hiến/), {
      target: { value: '2026-10-20T16:00' },
    });
    await user.click(screen.getByRole('button', { name: 'Tạo bản nháp' }));
    expect(
      await screen.findByText('Đã tạo bản nháp đợt hiến máu.'),
    ).toBeInTheDocument();
    const saved = await repository.list({
      search: 'Đợt hiến thử nghiệm',
      page: 1,
      limit: 10,
    });
    expect(saved.items[0]?.status).toBe('DRAFT');
  });
  it('prefills edit, keeps a server-invalid draft, then saves', async () => {
    const { user, repository } = await mount('/campaigns/demo-1/edit', true);
    const name = await screen.findByLabelText(/Tên đợt hiến máu/);
    expect(name).toHaveValue('Ngày hội giọt hồng');
    vi.spyOn(repository, 'update').mockRejectedValueOnce(
      new ApiRequestError('VALIDATION_ERROR', '', 400, {
        name: 'Tên đã tồn tại.',
      }),
    );
    await user.clear(name);
    await user.type(name, 'Tên mới');
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    expect(await screen.findByText('Tên đã tồn tại.')).toBeInTheDocument();
    expect(name).toHaveValue('Tên mới');
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    expect(await screen.findByText('Đã lưu đợt hiến máu.')).toBeInTheDocument();
  });
  it('confirms cancelling an unsaved form', async () => {
    const { user } = await mount('/campaigns/new', true);
    await user.type(
      await screen.findByLabelText(/Tên đợt hiến máu/),
      'Chưa lưu',
    );
    await user.click(screen.getByRole('button', { name: 'Hủy' }));
    const dialog = screen.getByRole('dialog');
    await user.click(
      within(dialog).getByRole('button', { name: 'Bỏ thay đổi' }),
    );
    expect(
      await screen.findByRole('heading', { name: /Mỗi lần sẻ chia/ }),
    ).toBeInTheDocument();
  });
  it('confirms lifecycle close and refreshes available actions', async () => {
    const { user } = await mount('/campaigns/demo-1', true);
    await user.click(
      await screen.findByRole('button', { name: 'Đóng đăng ký' }),
    );
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Đóng đăng ký',
      }),
    );
    expect(await screen.findByText('Đã đóng đăng ký')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Mở đăng ký' }),
    ).not.toBeInTheDocument();
  });
  it('validates slot ranges and saves an edited capacity', async () => {
    const { user, repository } = await mount(
      '/campaigns/demo-1/timeslots',
      true,
    );
    await user.click(
      (await screen.findAllByRole('button', { name: 'Sửa khung giờ' }))[0]!,
    );
    const capacity = screen.getByLabelText(/Số chỗ/);
    await user.clear(capacity);
    await user.type(capacity, '0');
    await user.click(screen.getByRole('button', { name: 'Lưu khung giờ' }));
    expect(capacity).toHaveAttribute('aria-invalid', 'true');
    await user.clear(capacity);
    await user.type(capacity, '30');
    await user.click(screen.getByRole('button', { name: 'Lưu khung giờ' }));
    expect(await screen.findByText('Đã lưu khung giờ.')).toBeInTheDocument();
    expect((await repository.slots('demo-1'))[0]?.capacity).toBe(30);
  });
  it('assigns and confirms removing staff', async () => {
    const { user, repository } = await mount('/campaigns/demo-1/staff', true);
    await user.click(
      await screen.findByRole('button', { name: 'Phân công nhân sự' }),
    );
    await user.selectOptions(
      await screen.findByLabelText(/^Nhân sự/),
      'staff-2',
    );
    await user.selectOptions(screen.getByLabelText('Nhiệm vụ'), 'SCREENING');
    await user.click(
      screen.getByRole('button', { name: 'Xác nhận phân công' }),
    );
    await screen.findByText('Đã phân công nhân sự.');
    await waitFor(() =>
      expect(
        screen.getAllByRole('button', { name: 'Gỡ phân công' }),
      ).toHaveLength(2),
    );
    await user.click(
      screen.getAllByRole('button', { name: 'Gỡ phân công' })[1]!,
    );
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Gỡ phân công',
      }),
    );
    await screen.findByText('Đã gỡ phân công nhân sự.');
    expect(await repository.staff('demo-1')).toHaveLength(1);
  });
});
describe('Domain boundaries', () => {
  it('checks campaign registration dates, integer targets, and terminal transitions', async () => {
    const repository = new MockCampaignRepository({ latency: 0 });
    const campaign = await repository.detail('demo-1');
    expect(
      validateCampaign({
        ...campaign,
        registrationOpensAt: campaign.startsAt,
        targetDonors: 1.5,
      }),
    ).toHaveProperty('registrationOpensAt');
    expect(validateCampaign({ ...campaign, targetDonors: 1.5 })).toHaveProperty(
      'targetDonors',
    );
    expect(canAct('CANCELLED', 'open')).toBe(false);
    expect(canAct('CLOSED', 'open')).toBe(false);
    expect(
      validateSlot(
        {
          startsAt: campaign.startsAt,
          endsAt: campaign.startsAt,
          capacity: 0,
          label: null,
        },
        campaign,
      ),
    ).toHaveProperty('endsAt');
    await expect(repository.update('demo-4', campaign)).rejects.toMatchObject({
      code: 'CAMPAIGN_NOT_EDITABLE',
    });
  });
});

import { describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppRoutes } from '@/app/router/AppRoutes';
import { createMockAuthService } from '@/features/auth/services/mock-auth.service';
import { renderWithAuth, signInAs } from '@/test/render';
import { CampaignRepositoryContext } from '@/features/campaigns/repository';
import { MockCampaignRepository } from '@/features/campaigns/mock-repository';
import { MockWorkflowRepository } from './mock-repository';
import { WorkflowRepositoryContext } from './repository';
import { sortCampaignsForOperationalStation, sortRegistrationsForCheckIn } from './domain';
import type { DonorRegistration } from './types';

const withRepositories = (node: ReactNode) => (
  <CampaignRepositoryContext.Provider
    value={new MockCampaignRepository({ latency: 0 })}
  >
    <WorkflowRepositoryContext.Provider
      value={new MockWorkflowRepository({ latency: 0 })}
    >
      {node}
    </WorkflowRepositoryContext.Provider>
  </CampaignRepositoryContext.Provider>
);

const startsAt = '2026-10-20T08:00:00.000Z';
const endsAt = '2026-10-20T08:30:00.000Z';

const newInput = (donorId: string) => ({
  donorId,
  donorName: 'Người Hiến X',
  donorPhone: '0900000000',
  campaign: {
    id: 'demo-1',
    name: 'Ngày hội giọt hồng',
    location: 'Nhà văn hóa Thanh Niên',
    startsAt,
    endsAt,
  },
  slot: { id: 'slot-donor-x', startsAt, endsAt },
  health: { answers: { FEVER: false }, confirmed: true },
});

const measurements = {
  BLOOD_PRESSURE_SYSTOLIC: 120,
  BLOOD_PRESSURE_DIASTOLIC: 80,
  PULSE: 78,
  WEIGHT: 62,
  TEMPERATURE: 36.8,
  HEMOGLOBIN: 14,
};

describe('MockWorkflowRepository', () => {
  it('runs registration → check-in → screening → blood bag → certificate', async () => {
    const repo = new MockWorkflowRepository({ latency: 0 });

    const registration = await repo.register(newInput('donor-x'));
    expect(registration.status).toBe('CONFIRMED');
    expect(registration.code).toMatch(/^REG-/);

    await expect(repo.register(newInput('donor-x'))).rejects.toMatchObject({
      code: 'REGISTRATION_DUPLICATE',
    });

    const counts = await repo.availability(['slot-donor-x']);
    expect(counts['slot-donor-x']).toBe(1);
    expect(await repo.myRegistrations('donor-x')).toHaveLength(1);

    const checkedIn = await repo.checkIn(registration.id);
    expect(checkedIn.checkedInAt).toBeTruthy();
    await expect(repo.checkIn(registration.id)).rejects.toMatchObject({
      code: 'REGISTRATION_ALREADY_CHECKED_IN',
    });

    const pending = await repo.screeningFor(registration.id);
    expect(pending?.status).toBe('PENDING');

    const saved = await repo.saveMeasurements(registration.id, measurements, {
      bloodGroup: 'O',
      rh: 'POSITIVE',
      infectiousTest: 'NEGATIVE',
    });
    expect(saved.status).toBe('WAITING_REVIEW');

    await expect(
      repo.reviewScreening(registration.id, 'INELIGIBLE', null),
    ).rejects.toMatchObject({ code: 'SCREENING_REVIEW_REASON_REQUIRED' });

    const reviewed = await repo.reviewScreening(
      registration.id,
      'ELIGIBLE',
      null,
    );
    expect(reviewed.status).toBe('ELIGIBLE');

    const bag = await repo.createBloodBag({
      registrationId: registration.id,
      code: 'BAG-TEST-1',
      volumeMl: 350,
      bloodGroup: 'O',
    });
    expect(bag.status).toBe('COLLECTED');

    const certificates = await repo.certificates('donor-x');
    expect(certificates.some((c) => c.donationId === registration.id)).toBe(
      true,
    );
    const history = await repo.history('donor-x');
    expect(history.some((entry) => entry.id === registration.id)).toBe(true);
  });

  it('refuses a blood bag for a donor who is not eligible', async () => {
    const repo = new MockWorkflowRepository({ latency: 0 });
    await expect(
      repo.createBloodBag({
        registrationId: 'seed-reg-1',
        code: 'BAG-X',
        volumeMl: 350,
        bloodGroup: null,
      }),
    ).rejects.toMatchObject({ code: 'SCREENING_NOT_ELIGIBLE' });
  });

  it('updates and deletes a blood bag in the repository', async () => {
    const repo = new MockWorkflowRepository({ latency: 0 });
    const bags = await repo.bloodBags();
    const target = bags[0]!;

    const updated = await repo.updateBloodBag(target.id, {
      volumeMl: 450,
      status: 'ACCEPTED',
      notes: 'Đã kiểm tra chất lượng',
    });
    expect(updated.volumeMl).toBe(450);
    expect(updated.status).toBe('ACCEPTED');

    await repo.deleteBloodBag(target.id);
    const afterDelete = await repo.bloodBags();
    expect(afterDelete.some((b) => b.id === target.id)).toBe(false);
  });

  it('finds a registration by code', async () => {
    const repo = new MockWorkflowRepository({ latency: 0 });
    const found = await repo.findRegistrations({ code: 'reg-00002' });
    expect(found).toHaveLength(1);
    expect(found[0]?.donorName).toBe('Trần Thanh Hà');
    expect(await repo.findRegistrations({ code: 'khong-co' })).toHaveLength(0);
  });
});

describe('clinic check-in page', () => {
  it('searches and checks in a donor via campaign selection', async () => {
    const user = userEvent.setup();
    const auth = createMockAuthService();
    await signInAs(auth, 'donation-staff@example.local');
    renderWithAuth(
      withRepositories(<AppRoutes />),
      { service: auth, route: '/clinic/check-in' },
    );

    expect(
      await screen.findByRole('heading', {
        name: 'Chọn đợt hiến máu để tiếp nhận',
      }),
    ).toBeInTheDocument();

    const campaignItem = (
      await screen.findByText('Ngày hội giọt hồng')
    ).closest('li');
    await user.click(
      within(campaignItem as HTMLElement).getByRole('link', {
        name: 'Vào bàn tiếp nhận',
      }),
    );

    expect(
      await screen.findByRole('heading', { name: 'Check-in người hiến' }),
    ).toBeInTheDocument();
    await user.type(screen.getByLabelText('Mã đăng ký'), 'REG-00001');
    await user.click(screen.getByRole('button', { name: 'Tìm kiếm' }));
    expect(await screen.findByText('Nguyễn Minh Anh')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Chọn' }));
    await user.click(
      await screen.findByRole('button', { name: 'Xác nhận Check-in' }),
    );
    expect(await screen.findByText(/Check-in thành công/)).toBeInTheDocument();
  });

  it('shows campaign selection at /clinic/screening', async () => {
    const auth = createMockAuthService();
    await signInAs(auth, 'donation-staff@example.local');
    renderWithAuth(
      withRepositories(<AppRoutes />),
      { service: auth, route: '/clinic/screening' },
    );

    expect(
      await screen.findByRole('heading', {
        name: 'Chọn đợt hiến máu để sàng lọc y tế',
      }),
    ).toBeInTheDocument();
    const screeningLinks = await screen.findAllByRole('link', {
      name: 'Vào bàn sàng lọc',
    });
    expect(screeningLinks.length).toBeGreaterThan(0);
  });

  it('blocks a donor from the clinic route', async () => {
    const auth = createMockAuthService();
    await signInAs(auth, 'donor@example.local');
    renderWithAuth(
      withRepositories(<AppRoutes />),
      { service: auth, route: '/clinic/check-in' },
    );
    expect(
      await screen.findByRole('heading', {
        name: 'Bạn không có quyền truy cập',
      }),
    ).toBeInTheDocument();
  });

  it('supports campaign-scoped check-in route', async () => {
    const auth = createMockAuthService();
    await signInAs(auth, 'donation-staff@example.local');
    renderWithAuth(
      withRepositories(<AppRoutes />),
      { service: auth, route: '/campaigns/demo-1/check-in' },
    );

    expect(
      await screen.findByRole('heading', { name: 'Check-in người hiến' }),
    ).toBeInTheDocument();
    expect(
      (await screen.findAllByText(/Ngày hội giọt hồng/)).length,
    ).toBeGreaterThan(0);
    expect(
      await screen.findByRole('button', { name: 'Tất cả đăng ký đợt này' }),
    ).toBeInTheDocument();
  });

  it('shows campaign selection at /clinic/blood-bags and supports scoped navigation', async () => {
    const user = userEvent.setup();
    const auth = createMockAuthService();
    await signInAs(auth, 'donation-staff@example.local');
    renderWithAuth(
      withRepositories(<AppRoutes />),
      { service: auth, route: '/clinic/blood-bags' },
    );

    expect(
      await screen.findByRole('heading', {
        name: 'Túi máu đã tiếp nhận',
      }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/Vui lòng chọn đợt hiến máu để quản lý và gắn mã túi máu theo đợt/),
    ).toBeInTheDocument();

    const campaignLinks = await screen.findAllByRole('link', {
      name: 'Vào quản lý túi máu',
    });
    expect(campaignLinks.length).toBeGreaterThan(0);

    await user.click(campaignLinks[0]!);

    expect(
      await screen.findByRole('heading', { name: /Ngày hội giọt hồng/ }),
    ).toBeInTheDocument();
    expect(
      (await screen.findAllByText(/Ngày hội giọt hồng/)).length,
    ).toBeGreaterThan(0);
    expect(
      await screen.findByRole('link', { name: 'Thêm túi máu' }),
    ).toBeInTheDocument();
  });

  it('opens blood bag detail modal and closes it', async () => {
    const user = userEvent.setup();
    const auth = createMockAuthService();
    await signInAs(auth, 'donation-staff@example.local');
    renderWithAuth(
      withRepositories(<AppRoutes />),
      { service: auth, route: '/clinic/blood-bags' },
    );

    const switchBtn = await screen.findByRole('button', { name: 'Xem toàn bộ túi máu' });
    await user.click(switchBtn);

    const detailBtns = await screen.findAllByRole('button', { name: 'Chi tiết' });
    expect(detailBtns.length).toBeGreaterThan(0);
    await user.click(detailBtns[0]!);

    expect(await screen.findByText('Hồ sơ lưu trữ túi máu')).toBeInTheDocument();
    expect(screen.getByText('Quản lý kho & Bảo quản')).toBeInTheDocument();

    const closeBtn = screen.getByRole('button', { name: 'Đóng' });
    await user.click(closeBtn);

    expect(screen.queryByText('Hồ sơ lưu trữ túi máu')).not.toBeInTheDocument();
  });
});

describe('donor registration page', () => {
  it('walks through campaign, slot, health and confirmation', async () => {
    const user = userEvent.setup();
    const auth = createMockAuthService();
    await signInAs(auth, 'donor@example.local');
    renderWithAuth(withRepositories(<AppRoutes />), {
      service: auth,
      route: '/donor/register',
    });

    expect(
      await screen.findByRole('heading', { name: 'Đặt lịch hiến máu của bạn' }),
    ).toBeInTheDocument();
    // Only the seeded first campaign has time slots in the campaign mock.
    const campaignItem = (
      await screen.findByText('Ngày hội giọt hồng')
    ).closest('li');
    await user.click(
      within(campaignItem as HTMLElement).getByRole('button', {
        name: 'Chọn đợt này',
      }),
    );
    expect(
      await screen.findByRole('heading', { name: /Bước 2/ }),
    ).toBeInTheDocument();

    const slotButtons = await screen.findAllByRole('button', {
      name: 'Chọn khung giờ',
    });
    await user.click(slotButtons[0]!);
    expect(
      await screen.findByRole('heading', { name: /Bước 3/ }),
    ).toBeInTheDocument();

    for (const question of screen.getAllByText('Không'))
      await user.click(question);
    await user.click(
      screen.getByLabelText(
        'Tôi xác nhận các thông tin khai báo trên là đúng sự thật.',
      ),
    );
    await user.click(screen.getByRole('button', { name: 'Tiếp tục' }));
    expect(
      await screen.findByRole('heading', { name: /Bước 4/ }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Xác nhận đăng ký' }));
    expect(
      await screen.findByRole('heading', { name: /Bước 5/ }),
    ).toBeInTheDocument();
  });

  it('jumps to the slot step when a campaign is preselected', async () => {
    const user = userEvent.setup();
    const auth = createMockAuthService();
    await signInAs(auth, 'donor@example.local');
    renderWithAuth(withRepositories(<AppRoutes />), {
      service: auth,
      route: '/donor/register?campaign=demo-1',
    });

    // The campaign chosen on the campaign page skips the duplicate picker.
    expect(
      await screen.findByRole('heading', { name: /Bước 2/ }),
    ).toBeInTheDocument();
    expect(await screen.findByText(/Ngày hội giọt hồng/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Đổi đợt hiến' }));
    expect(
      await screen.findByRole('heading', { name: /Bước 1/ }),
    ).toBeInTheDocument();
  });

  it('stays on the picker when the preselected campaign is not open', async () => {
    const auth = createMockAuthService();
    await signInAs(auth, 'donor@example.local');
    renderWithAuth(withRepositories(<AppRoutes />), {
      service: auth,
      // demo-3 is CLOSED, so it is not in the open-campaign list.
      route: '/donor/register?campaign=demo-3',
    });

    expect(
      await screen.findByRole('heading', { name: /Bước 1/ }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/Đợt hiến máu bạn chọn hiện không mở đăng ký/),
    ).toBeInTheDocument();
  });
});

describe('sortCampaignsForOperationalStation', () => {
  it('prioritizes active/open campaigns at the top of the list', () => {
    const items = [
      {
        campaign: {
          startsAt: '2026-10-10T08:00:00.000Z',
          endsAt: '2026-10-10T16:00:00.000Z',
          status: 'CLOSED',
        },
        window: {
          status: 'CLOSED' as const,
          isOpen: false,
          opensAt: new Date('2026-10-10T07:00:00.000Z'),
          closesAt: new Date('2026-10-10T17:00:00.000Z'),
          message: 'Closed',
        },
      },
      {
        campaign: {
          startsAt: '2026-10-25T08:00:00.000Z',
          endsAt: '2026-10-25T16:00:00.000Z',
          status: 'OPEN',
        },
        window: {
          status: 'UPCOMING' as const,
          isOpen: false,
          opensAt: new Date('2026-10-25T07:00:00.000Z'),
          closesAt: new Date('2026-10-25T17:00:00.000Z'),
          message: 'Upcoming',
        },
      },
      {
        campaign: {
          startsAt: '2026-10-20T08:00:00.000Z',
          endsAt: '2026-10-20T16:00:00.000Z',
          status: 'OPEN',
        },
        window: {
          status: 'ACTIVE' as const,
          isOpen: true,
          opensAt: new Date('2026-10-20T07:00:00.000Z'),
          closesAt: new Date('2026-10-20T17:00:00.000Z'),
          message: 'Active now',
        },
      },
    ];

    const sorted = sortCampaignsForOperationalStation(items);
    expect(sorted[0]?.window.status).toBe('ACTIVE');
    expect(sorted[0]?.campaign.status).toBe('OPEN');
    expect(sorted[1]?.window.status).toBe('UPCOMING');
    expect(sorted[2]?.window.status).toBe('CLOSED');
  });
});

describe('sortRegistrationsForCheckIn', () => {
  it('always prioritizes un-checked-in donors to the top and sorts by slot and check-in time', () => {
    const list: DonorRegistration[] = [
      {
        id: 'reg-1',
        code: 'REG-00001',
        donorId: 'd-1',
        donorName: 'Nguyễn Văn Đã Check In Sớm',
        donorPhone: '0901',
        donorIdentity: null,
        campaignId: 'camp-1',
        campaignName: 'Chiến dịch A',
        location: 'Trạm 1',
        campaignStartsAt: '2026-10-20T07:00:00Z',
        campaignEndsAt: '2026-10-20T17:00:00Z',
        slotId: 'slot-1',
        slotStartsAt: '2026-10-20T08:00:00Z',
        slotEndsAt: '2026-10-20T09:00:00Z',
        status: 'CONFIRMED',
        healthDeclaration: null,
        checkedInAt: '2026-10-20T08:15:00Z',
        createdAt: '2026-10-18T10:00:00Z',
      },
      {
        id: 'reg-2',
        code: 'REG-00002',
        donorId: 'd-2',
        donorName: 'Trần Chưa Check In Ca Chiều',
        donorPhone: '0902',
        donorIdentity: null,
        campaignId: 'camp-1',
        campaignName: 'Chiến dịch A',
        location: 'Trạm 1',
        campaignStartsAt: '2026-10-20T07:00:00Z',
        campaignEndsAt: '2026-10-20T17:00:00Z',
        slotId: 'slot-2',
        slotStartsAt: '2026-10-20T14:00:00Z',
        slotEndsAt: '2026-10-20T15:00:00Z',
        status: 'SCHEDULED',
        healthDeclaration: null,
        checkedInAt: null,
        createdAt: '2026-10-18T12:00:00Z',
      },
      {
        id: 'reg-3',
        code: 'REG-00003',
        donorId: 'd-3',
        donorName: 'Lê Chưa Check In Ca Sáng',
        donorPhone: '0903',
        donorIdentity: null,
        campaignId: 'camp-1',
        campaignName: 'Chiến dịch A',
        location: 'Trạm 1',
        campaignStartsAt: '2026-10-20T07:00:00Z',
        campaignEndsAt: '2026-10-20T17:00:00Z',
        slotId: 'slot-1',
        slotStartsAt: '2026-10-20T08:00:00Z',
        slotEndsAt: '2026-10-20T09:00:00Z',
        status: 'CONFIRMED',
        healthDeclaration: null,
        checkedInAt: null,
        createdAt: '2026-10-18T11:00:00Z',
      },
      {
        id: 'reg-4',
        code: 'REG-00004',
        donorId: 'd-4',
        donorName: 'Phạm Đã Check In Mới Nhất',
        donorPhone: '0904',
        donorIdentity: null,
        campaignId: 'camp-1',
        campaignName: 'Chiến dịch A',
        location: 'Trạm 1',
        campaignStartsAt: '2026-10-20T07:00:00Z',
        campaignEndsAt: '2026-10-20T17:00:00Z',
        slotId: 'slot-1',
        slotStartsAt: '2026-10-20T08:00:00Z',
        slotEndsAt: '2026-10-20T09:00:00Z',
        status: 'CONFIRMED',
        healthDeclaration: null,
        checkedInAt: '2026-10-20T08:45:00Z',
        createdAt: '2026-10-18T10:30:00Z',
      },
    ];

    const sorted = sortRegistrationsForCheckIn(list);

    // Un-checked-in donors come first:
    expect(sorted[0]?.id).toBe('reg-3'); // Chưa check in ca 08:00
    expect(sorted[1]?.id).toBe('reg-2'); // Chưa check in ca 14:00
    // Checked-in donors come later, sorted by most recently checked in first:
    expect(sorted[2]?.id).toBe('reg-4'); // Check-in lúc 08:45
    expect(sorted[3]?.id).toBe('reg-1'); // Check-in lúc 08:15
  });
});

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

  it('finds a registration by code', async () => {
    const repo = new MockWorkflowRepository({ latency: 0 });
    const found = await repo.findRegistrations({ code: 'reg-00002' });
    expect(found).toHaveLength(1);
    expect(found[0]?.donorName).toBe('Trần Thanh Hà');
    expect(await repo.findRegistrations({ code: 'khong-co' })).toHaveLength(0);
  });
});

describe('clinic check-in page', () => {
  it('searches and checks in a donor', async () => {
    const user = userEvent.setup();
    const auth = createMockAuthService();
    await signInAs(auth, 'donation-staff@example.local');
    renderWithAuth(
      <WorkflowRepositoryContext.Provider
        value={new MockWorkflowRepository({ latency: 0 })}
      >
        <AppRoutes />
      </WorkflowRepositoryContext.Provider>,
      { service: auth, route: '/clinic/check-in' },
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

  it('blocks a donor from the clinic route', async () => {
    const auth = createMockAuthService();
    await signInAs(auth, 'donor@example.local');
    renderWithAuth(
      <WorkflowRepositoryContext.Provider
        value={new MockWorkflowRepository({ latency: 0 })}
      >
        <AppRoutes />
      </WorkflowRepositoryContext.Provider>,
      { service: auth, route: '/clinic/check-in' },
    );
    expect(
      await screen.findByRole('heading', {
        name: 'Bạn không có quyền truy cập',
      }),
    ).toBeInTheDocument();
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

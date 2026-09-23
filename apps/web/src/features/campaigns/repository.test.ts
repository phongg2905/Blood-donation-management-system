import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiGet, apiPatch, apiPost } from '@/services/api';
import { ApiCampaignRepository } from './repository';
import { MockCampaignRepository } from './mock-repository';

vi.mock('@/services/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/api')>()),
  apiGet: vi.fn(),
  apiPatch: vi.fn(),
  apiPost: vi.fn(),
}));
beforeEach(() => vi.clearAllMocks());

describe('Phase 3 HTTP boundary (mocked transport, not real API integration)', () => {
  it('maps list envelope and pagination without leaking HTTP shape into UI', async () => {
    const campaign = await new MockCampaignRepository({ latency: 0 }).detail(
      'demo-1',
    );
    const meta = { page: 2, limit: 6, total: 8, totalPages: 2 };
    vi.mocked(apiGet).mockResolvedValue({
      success: true,
      data: [campaign],
      meta,
    });
    const result = await new ApiCampaignRepository().list({
      page: 2,
      limit: 6,
      status: 'OPEN',
    });
    expect(apiGet).toHaveBeenCalledWith(
      '/campaigns?page=2&limit=6&status=OPEN',
    );
    expect(result).toEqual({ items: [campaign], meta });
  });
  it('does not fabricate missing pagination', async () => {
    vi.mocked(apiGet).mockResolvedValue({ success: true, data: [] });
    await expect(
      new ApiCampaignRepository().list({ page: 1, limit: 6 }),
    ).rejects.toMatchObject({ status: 500 });
  });
  it('sends campaign updates and lifecycle actions to documented endpoints', async () => {
    const {
      id,
      status,
      ...input
    } = await new MockCampaignRepository({ latency: 0 }).detail('demo-1');
    const campaign = { ...input, id, status };
    vi.mocked(apiPatch).mockResolvedValue({ success: true, data: campaign });
    vi.mocked(apiPost).mockResolvedValue({
      success: true,
      data: { ...campaign, status: 'CLOSED' },
    });
    const repository = new ApiCampaignRepository();
    await repository.update(id, input);
    await repository.transition(id, 'close');
    expect(apiPatch).toHaveBeenCalledWith('/campaigns/demo-1', input);
    expect(apiPost).toHaveBeenCalledWith('/campaigns/demo-1/close');
  });
  it('uses documented slot endpoints and keeps staff URLs unresolved', async () => {
    const slot = (
      await new MockCampaignRepository({ latency: 0 }).slots('demo-1')
    )[0]!;
    const { id, campaignId, isActive, ...input } = slot;
    vi.mocked(apiPost).mockResolvedValue({ success: true, data: slot });
    const repository = new ApiCampaignRepository();
    expect(await repository.createSlot(campaignId, input)).toMatchObject({ isActive });
    await repository.deactivateSlot(id);
    expect(apiPost).toHaveBeenCalledWith('/campaigns/demo-1/time-slots', input);
    expect(apiPost).toHaveBeenCalledWith('/time-slots/slot-0/deactivate');
    await expect(repository.staff(campaignId)).rejects.toMatchObject({
      status: 503,
    });
    expect(apiGet).not.toHaveBeenCalled();
  });
});

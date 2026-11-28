import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiWorkflowRepository } from './repository';
import { ApiAdminRepository } from '@/features/admin/repository';
import { apiGetAll, setRefreshHandler } from '@/services/api';

const ok = (
  data: unknown,
  meta?: { page: number; limit: number; total: number },
) =>
  new Response(
    JSON.stringify({ success: true, data, ...(meta ? { meta } : {}) }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  );
afterEach(() => {
  vi.unstubAllGlobals();
  setRefreshHandler(null);
});

describe('real API workflow adapters', () => {
  it('loads all pages while preserving campaign filters', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        ok([{ id: 'first' }], { page: 1, limit: 1, total: 2 }),
      )
      .mockResolvedValueOnce(
        ok([{ id: 'second' }], { page: 2, limit: 1, total: 2 }),
      );
    vi.stubGlobal('fetch', fetchMock);
    expect(await apiGetAll('/blood-bags?campaignId=campaign-1')).toEqual([
      { id: 'first' },
      { id: 'second' },
    ]);
    expect(fetchMock.mock.calls[1]?.[0]).toContain('campaignId=campaign-1');
    expect(fetchMock.mock.calls[1]?.[0]).toContain('page=2');
  });

  it('finds the actual screening ID through the queue instead of querying by check-in ID', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      ok([
        {
          id: 'checkin-1',
          registrationId: 'registration-1',
          checkedInAt: '2030-01-01T08:00:00Z',
          registration: {
            id: 'registration-1',
            donorId: 'donor-1',
            campaignId: 'campaign-1',
            status: 'CONFIRMED',
          },
          screening: { id: 'screening-1', status: 'WAITING_REVIEW' },
        },
      ]),
    );
    vi.stubGlobal('fetch', fetchMock);
    expect(
      (await new ApiWorkflowRepository().screeningFor('registration-1'))?.id,
    ).toBe('screening-1');
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/screenings/queue');
  });

  it('surfaces failed workflow requests so the UI can display an error and retry', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('Disconnected')),
    );
    const repository = new ApiWorkflowRepository();
    await expect(repository.myRegistrations()).rejects.toThrow('Disconnected');
    await expect(repository.bloodBags()).rejects.toThrow('Disconnected');
    await expect(repository.screeningQueue()).rejects.toThrow('Disconnected');
    await expect(repository.eligibleForBag()).rejects.toThrow('Disconnected');
  });

  it('never presents a failed settings write as a saved setting', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({
              success: false,
              error: { code: 'FORBIDDEN', message: 'Forbidden' },
            }),
            { status: 403 },
          ),
        ),
    );
    await expect(
      new ApiAdminRepository().updateSetting('site_name', { value: 'new' }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('preserves unknown historical volumes instead of inventing a donation volume', async () => {
    const history = [
      {
        id: 'registration-1',
        volumeMl: null,
        bloodGroup: null,
        status: 'COMPLETED',
      },
    ];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok(history)));
    expect(await new ApiWorkflowRepository().history()).toEqual(history);
  });
});

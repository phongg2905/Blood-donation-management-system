import { afterEach, describe, expect, it, vi } from 'vitest';
import { setAccessToken } from '@/services/api';
import { notificationService } from './notification.service';
import { ApiWorkflowRepository } from '../../workflow/repository';

const ok = (data: unknown, meta?: unknown) =>
  new Response(JSON.stringify({ success: true, data, meta }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

afterEach(() => {
  setAccessToken(null);
  vi.unstubAllGlobals();
});

describe('notificationService', () => {
  it('fetches notification list with pagination query', async () => {
    const mockNotifications = [
      {
        id: 'notif-1',
        userId: 'user-1',
        title: 'Xác nhận đăng ký hiến máu',
        message: 'Đăng ký của bạn đã được ghi nhận',
        type: 'REGISTRATION',
        channel: 'EMAIL',
        status: 'SENT',
        readAt: null,
        createdAt: '2026-09-29T10:00:00Z',
        updatedAt: '2026-09-29T10:00:00Z',
      },
    ];
    const mockMeta = { page: 1, limit: 10, total: 1, totalPages: 1 };

    const fetchMock = vi.fn().mockResolvedValue(ok(mockNotifications, mockMeta));
    vi.stubGlobal('fetch', fetchMock);

    const result = await notificationService.list({ page: 1, limit: 10 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = fetchMock.mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain('/notifications?page=1&limit=10');
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.title).toBe('Xác nhận đăng ký hiến máu');
    expect(result.meta).toEqual(mockMeta);
  });

  it('marks a notification as read via PATCH', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({}));
    vi.stubGlobal('fetch', fetchMock);

    await notificationService.markRead('notif-123');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = (fetchMock.mock.calls[0] ?? []) as [string, RequestInit];
    expect(calledUrl).toContain('/notifications/notif-123/read');
    expect(init.method).toBe('PATCH');
  });
});

describe('ApiWorkflowRepository - Certificate File Attachment', () => {
  it('attaches certificate file via POST /certificates/:id/file', async () => {
    const mockCert = {
      id: 'cert-1',
      code: 'CERT-2026-0001',
      donationId: 'donation-1',
      issuedAt: '2026-09-29T10:30:00Z',
      status: 'ACTIVE',
      fileUrl: 'https://cdn.example.com/certs/cert-1.pdf',
    };

    const fetchMock = vi.fn().mockResolvedValue(ok(mockCert));
    vi.stubGlobal('fetch', fetchMock);

    const repo = new ApiWorkflowRepository();
    const result = await repo.attachCertificateFile('cert-1', 'https://cdn.example.com/certs/cert-1.pdf');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = (fetchMock.mock.calls[0] ?? []) as [string, RequestInit];
    expect(calledUrl).toContain('/certificates/cert-1/file');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      fileUrl: 'https://cdn.example.com/certs/cert-1.pdf',
    });
    expect(result.fileUrl).toBe('https://cdn.example.com/certs/cert-1.pdf');
    expect(result.code).toBe('CERT-2026-0001');
  });
});

import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button, FormField, Input } from '@/components/ui';
import { Feedback, QueryState } from '@/features/campaigns/components';
import { useCampaignRepository } from '@/features/campaigns/repository';
import { useCampaignQuery } from '@/features/campaigns/hooks';
import {
  OPERATIONAL_STATUS_SHORT_LABELS,
  REGISTRATION_STATUS_LABELS,
  formatDate,
  formatSlotRange,
  getOperationalWindow,
} from './domain';
import { useWorkflowMutation, useWorkflowQuery } from './hooks';
import { useWorkflowRepository } from './repository';
import { DetailList, StatusPill, WorkflowShell } from './components';
import type { CheckInQuery, DonorRegistration } from './types';

const statusTone = (registration: DonorRegistration) => {
  if (registration.checkedInAt) return 'success' as const;
  if (registration.status === 'CANCELLED' || registration.status === 'NO_SHOW') return 'danger' as const;
  return 'info' as const;
};

function CheckInModal({
  selected,
  onClose,
  canCheckIn,
  onCheckIn,
  onNoShow,
  pending,
  error,
  success,
  supportNoShow,
}: {
  selected: DonorRegistration;
  onClose: () => void;
  canCheckIn: boolean;
  onCheckIn: () => void;
  onNoShow?: () => void;
  pending: boolean;
  error?: { message: string } | null;
  success?: string | null;
  supportNoShow: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef(document.activeElement as HTMLElement | null);

  useEffect(() => {
    const dialog = dialogRef.current;
    const trigger = triggerRef.current;
    if (dialog && !dialog.open) {
      if (typeof dialog.showModal === 'function') {
        dialog.showModal();
      } else {
        dialog.setAttribute('open', '');
      }
    }
    return () => {
      if (dialog?.open) {
        if (typeof dialog.close === 'function') {
          dialog.close();
        } else {
          dialog.removeAttribute('open');
        }
      }
      trigger?.focus();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="campaign-dialog"
      aria-labelledby="checkin-modal-title"
      tabIndex={-1}
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onClose();
      }}
      onClick={(event) => {
        const rect = dialogRef.current?.getBoundingClientRect();
        if (rect) {
          const isOutside =
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom;
          if (isOutside && !pending) {
            onClose();
          }
        }
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 id="checkin-modal-title" style={{ margin: 0, fontSize: '1.25rem' }}>
          Xác nhận Check-in người hiến
        </h2>
        <Button variant="secondary" onClick={onClose} style={{ padding: '4px 10px', fontSize: '0.85rem' }}>
          ✕
        </Button>
      </div>

      <DetailList
        items={[
          { label: 'Người hiến', value: selected.donorName },
          { label: 'Mã đăng ký', value: selected.code },
          { label: 'CCCD', value: selected.donorIdentity ?? '—' },
          { label: 'Đợt hiến', value: selected.campaignName },
          {
            label: 'Khung giờ',
            value: formatSlotRange(selected.slotStartsAt, selected.slotEndsAt),
          },
          {
            label: 'Trạng thái',
            value: REGISTRATION_STATUS_LABELS[selected.status],
          },
          {
            label: 'Check-in',
            value: selected.checkedInAt
              ? new Date(selected.checkedInAt).toLocaleTimeString('vi-VN')
              : 'Chưa check-in',
          },
        ]}
      />

      <Feedback error={error} success={success ?? undefined} />

      {selected.status === 'NO_SHOW' && (
        <p className="workflow-muted" style={{ color: 'var(--color-danger, #dc2626)', marginTop: '10px' }}>
          Đăng ký này đã được ghi nhận vắng mặt (No-show). Không thể tiếp nhận check-in.
        </p>
      )}

      {!canCheckIn && !selected.checkedInAt && selected.status !== 'NO_SHOW' && (
        <p className="workflow-muted" style={{ marginTop: '10px' }}>
          Chỉ đăng ký đã xếp lịch hoặc đã xác nhận mới được check-in / đánh dấu vắng mặt.
        </p>
      )}

      <div className="campaign-actions" style={{ marginTop: '24px', display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <Button variant="secondary" type="button" onClick={onClose}>
          Đóng
        </Button>
        {supportNoShow && onNoShow && (
          <Button
            variant="secondary"
            type="button"
            isLoading={pending}
            disabled={!canCheckIn}
            onClick={onNoShow}
          >
            Đánh dấu vắng mặt (No-show)
          </Button>
        )}
        <Button
          type="button"
          isLoading={pending}
          disabled={!canCheckIn}
          onClick={onCheckIn}
        >
          Xác nhận Check-in
        </Button>
      </div>
    </dialog>
  );
}

export function CheckInPage() {
  const { campaignId } = useParams<{ campaignId?: string }>();
  const workflow = useWorkflowRepository();
  const campaignRepo = useCampaignRepository();
  const mutation = useWorkflowMutation();

  const campaignQuery = useCampaignQuery(
    `checkin-campaign:${campaignId}`,
    () => campaignRepo.detail(campaignId!),
    Boolean(campaignId),
  );

  const campaignsListQuery = useCampaignQuery(
    'checkin-campaigns-list',
    () => campaignRepo.list({ page: 1, limit: 30, sort: 'desc' }),
    !campaignId,
  );

  const [form, setForm] = useState<CheckInQuery>({
    code: '',
    identity: '',
    phone: '',
  });
  const [search, setSearch] = useState<CheckInQuery | null>(
    campaignId ? { campaignId } : null,
  );
  const [selected, setSelected] = useState<DonorRegistration | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'UPCOMING' | 'CLOSED'>('ALL');
  const isTestEnv = import.meta.env.MODE === 'test';

  useEffect(() => {
    if (campaignId) {
      setSearch({ campaignId });
    }
  }, [campaignId]);

  const results = useWorkflowQuery(
    `checkin:${JSON.stringify(search)}`,
    () => workflow.findRegistrations(search ?? {}),
    search !== null,
  );

  const operationalWindow = campaignQuery.data
    ? getOperationalWindow(campaignQuery.data.startsAt, campaignQuery.data.endsAt)
    : null;

  const isClosedOrUpcoming = !isTestEnv && operationalWindow !== null && operationalWindow.status !== 'ACTIVE';

  const canCheckIn =
    selected !== null &&
    selected.checkedInAt === null &&
    (selected.status === 'SCHEDULED' || selected.status === 'CONFIRMED');

  function submitSearch() {
    setSelected(null);
    setSearch({
      ...form,
      ...(campaignId ? { campaignId } : {}),
    });
  }

  function confirmCheckIn() {
    if (!selected) return;
    void mutation.run(
      () => workflow.checkIn(selected.id),
      (registration) => {
        setSelected(registration);
        results.retry();
      },
      'Check-in thành công. Người hiến đã được đưa vào hàng chờ sàng lọc.',
    );
  }

  function confirmNoShow() {
    if (!selected || !workflow.markNoShow) return;
    void mutation.run(
      () => workflow.markNoShow!(selected.id),
      (registration) => {
        setSelected(registration);
        results.retry();
      },
      'Đã ghi nhận người hiến vắng mặt (No-show).',
    );
  }

  // 1. If accessed without a campaignId (via /clinic/check-in):
  // Display the list of campaigns with the 3 status filter tabs!
  if (!campaignId) {
    const campaignsWithWindow = (campaignsListQuery.data?.items ?? []).map((campaign) => ({
      campaign,
      window: getOperationalWindow(campaign.startsAt, campaign.endsAt),
    }));

    const totalCount = campaignsWithWindow.length;
    const activeCount = campaignsWithWindow.filter((c) => c.window.status === 'ACTIVE').length;
    const upcomingCount = campaignsWithWindow.filter((c) => c.window.status === 'UPCOMING').length;
    const closedCount = campaignsWithWindow.filter((c) => c.window.status === 'CLOSED').length;

    const filteredCampaigns = campaignsWithWindow.filter((c) => {
      if (statusFilter === 'ALL') return true;
      return c.window.status === statusFilter;
    });

    return (
      <WorkflowShell
        eyebrow="Quầy tiếp nhận"
        title="Chọn đợt hiến máu để tiếp nhận"
        lead="Vui lòng chọn đợt hiến máu đang mở tác nghiệp để vào quầy tiếp nhận và check-in cho người hiến."
      >
        <QueryState {...campaignsListQuery} />

        <div className="station-filter-bar" role="tablist" aria-label="Bộ lọc trạng thái đợt hiến">
          <button
            type="button"
            className={`station-filter-btn ${statusFilter === 'ALL' ? 'station-filter-btn--active' : ''}`}
            onClick={() => setStatusFilter('ALL')}
          >
            Tất cả <span className="station-filter-btn__count">{totalCount}</span>
          </button>
          <button
            type="button"
            className={`station-filter-btn ${statusFilter === 'ACTIVE' ? 'station-filter-btn--active' : ''}`}
            onClick={() => setStatusFilter('ACTIVE')}
          >
            Mở <span className="station-filter-btn__count">{activeCount}</span>
          </button>
          <button
            type="button"
            className={`station-filter-btn ${statusFilter === 'UPCOMING' ? 'station-filter-btn--active' : ''}`}
            onClick={() => setStatusFilter('UPCOMING')}
          >
            Chưa mở <span className="station-filter-btn__count">{upcomingCount}</span>
          </button>
          <button
            type="button"
            className={`station-filter-btn ${statusFilter === 'CLOSED' ? 'station-filter-btn--active' : ''}`}
            onClick={() => setStatusFilter('CLOSED')}
          >
            Đã đóng <span className="station-filter-btn__count">{closedCount}</span>
          </button>
        </div>

        {filteredCampaigns.length === 0 && (
          <p className="workflow-empty">
            {statusFilter === 'ACTIVE'
              ? 'Hiện không có đợt hiến máu nào đang trong giờ mở quầy.'
              : statusFilter === 'UPCOMING'
                ? 'Không có đợt hiến nào chưa mở.'
                : statusFilter === 'CLOSED'
                  ? 'Không có đợt hiến nào đã đóng.'
                  : 'Hiện không có đợt hiến máu nào.'}
          </p>
        )}

        <ul className="workflow-list">
          {filteredCampaigns.map(({ campaign, window }) => {
            const isOpen = isTestEnv || window.status === 'ACTIVE';
            return (
              <li key={campaign.id} className="workflow-list__item">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0 }}>{campaign.name}</h3>
                    <span
                      className={`station-badge-live station-badge-live--${
                        window.status === 'ACTIVE'
                          ? 'active'
                          : window.status === 'UPCOMING'
                            ? 'upcoming'
                            : 'closed'
                      }`}
                    >
                      {OPERATIONAL_STATUS_SHORT_LABELS[window.status]}
                    </span>
                  </div>
                  <p className="workflow-muted">
                    📍 {campaign.location} · ⏰ {formatDate(campaign.startsAt)}
                  </p>
                  <p className="workflow-muted" style={{ fontSize: '0.8rem' }}>
                    {window.message}
                  </p>
                  {campaign.targetDonors && (
                    <p className="workflow-muted">
                      Chỉ tiêu: {campaign.targetDonors.toLocaleString('vi-VN')} người hiến
                    </p>
                  )}
                </div>
                <div className="workflow-list__side">
                  <StatusPill tone={campaign.status === 'OPEN' ? 'success' : 'neutral'}>
                    {campaign.status === 'OPEN' ? 'Đang mở' : campaign.status}
                  </StatusPill>
                  {isOpen ? (
                    <Link
                      className="btn btn--primary"
                      to={`/campaigns/${campaign.id}/check-in`}
                    >
                      Vào bàn tiếp nhận
                    </Link>
                  ) : (
                    <Button
                      disabled
                      variant="secondary"
                      title="Chỉ mở tiếp nhận trong khung giờ quy định"
                    >
                      {OPERATIONAL_STATUS_SHORT_LABELS[window.status]}
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </WorkflowShell>
    );
  }

  // 2. Direct desk route: Block access early if campaign is not 'Mở'
  if (isClosedOrUpcoming && operationalWindow) {
    return (
      <WorkflowShell
        eyebrow="Quầy tiếp nhận"
        title="Quầy tiếp nhận tạm khóa"
        back="/clinic/check-in"
        backLabel="Chọn đợt hiến khác"
      >
        <div className="station-blocked">
          <div className="station-blocked__icon">🔒</div>
          <span
            className={`station-badge-live station-badge-live--${
              operationalWindow.status === 'UPCOMING' ? 'upcoming' : 'closed'
            }`}
          >
            {OPERATIONAL_STATUS_SHORT_LABELS[operationalWindow.status]}
          </span>
          <h2 className="station-blocked__title">
            {campaignQuery.data?.name ?? 'Đợt hiến'}
          </h2>
          <p className="station-blocked__desc">
            {operationalWindow.message}
          </p>
          {campaignQuery.data && (
            <p className="workflow-muted" style={{ fontSize: '0.85rem' }}>
              📍 {campaignQuery.data.location} · ⏰ {formatDate(campaignQuery.data.startsAt)}
            </p>
          )}
          <div className="station-blocked__actions">
            <Link className="btn btn--primary" to="/clinic/check-in">
              Chọn đợt hiến đang mở
            </Link>
            <Link className="btn btn--secondary" to={`/campaigns/${campaignId}`}>
              Xem chi tiết đợt hiến
            </Link>
          </div>
        </div>
      </WorkflowShell>
    );
  }

  // 3. Render active check-in desk workspace
  return (
    <WorkflowShell
      eyebrow={campaignQuery.data ? `Quầy tiếp nhận · ${campaignQuery.data.name}` : 'Quầy tiếp nhận'}
      title="Check-in người hiến"
      lead={
        campaignQuery.data
          ? `Điểm hiến: ${campaignQuery.data.location}. Xác nhận người hiến đã có mặt tại đợt hiến này.`
          : 'Tìm người hiến theo mã đăng ký, số CCCD hoặc số điện thoại, rồi xác nhận đã đến.'
      }
      back={`/campaigns/${campaignId}`}
      backLabel="Quay lại đợt hiến"
    >
      {campaignQuery.data && (
        <section className="station-hero" aria-label="Thông tin đợt tác nghiệp">
          <div className="station-hero__header">
            <div className="station-hero__title-wrap">
              <h2 className="station-hero__title">
                {campaignQuery.data.name}
                {operationalWindow && (
                  <span
                    className={`station-badge-live station-badge-live--${
                      operationalWindow.status === 'ACTIVE'
                        ? 'active'
                        : operationalWindow.status === 'UPCOMING'
                          ? 'upcoming'
                          : 'closed'
                    }`}
                  >
                    {OPERATIONAL_STATUS_SHORT_LABELS[operationalWindow.status]}
                  </span>
                )}
              </h2>
              <div className="station-hero__meta">
                <span className="station-hero__meta-item">
                  📍 {campaignQuery.data.location}
                </span>
                <span className="station-hero__meta-item">
                  ⏰ {formatDate(campaignQuery.data.startsAt)} (
                  {new Date(campaignQuery.data.startsAt).toLocaleTimeString('vi-VN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  –{' '}
                  {new Date(campaignQuery.data.endsAt).toLocaleTimeString('vi-VN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  )
                </span>
              </div>
            </div>
          </div>
          <nav className="station-hero__nav" aria-label="Điều hướng tác nghiệp tại điểm hiến">
            <Link
              className="station-nav-link station-nav-link--active"
              to={`/campaigns/${campaignId}/check-in`}
            >
              Quầy tiếp nhận
            </Link>
            <Link
              className="station-nav-link"
              to={`/campaigns/${campaignId}/screening`}
            >
              Hàng chờ sàng lọc
            </Link>
            <Link
              className="station-nav-link"
              to={`/campaigns/${campaignId}`}
            >
              Chi tiết đợt hiến
            </Link>
          </nav>
        </section>
      )}

      <section className="workflow-card" aria-labelledby="checkin-search">
        <h2 id="checkin-search">
          {campaignId ? 'Tìm kiếm trong đợt này' : 'Tra cứu người hiến'}
        </h2>
        <form
          className="station-search-box"
          onSubmit={(event) => {
            event.preventDefault();
            submitSearch();
          }}
        >
          <div className="station-search-grid">
            <FormField id="checkin-code" label="Mã đăng ký">
              <Input
                value={form.code}
                placeholder="VD: REG-00001"
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, code: event.target.value }))
                }
              />
            </FormField>
            <FormField id="checkin-identity" label="Số CCCD">
              <Input
                value={form.identity}
                inputMode="numeric"
                placeholder="VD: 079..."
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, identity: event.target.value }))
                }
              />
            </FormField>
            <FormField id="checkin-phone" label="Số điện thoại">
              <Input
                value={form.phone}
                inputMode="tel"
                placeholder="VD: 09..."
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, phone: event.target.value }))
                }
              />
            </FormField>
          </div>
          <div className="station-search-actions">
            <Button type="submit">Tìm kiếm</Button>
            {campaignId && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setForm({ code: '', identity: '', phone: '' });
                  setSelected(null);
                  setSearch({ campaignId });
                }}
              >
                Tất cả đăng ký đợt này
              </Button>
            )}
            {(form.code || form.identity || form.phone) && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setForm({ code: '', identity: '', phone: '' });
                  setSelected(null);
                  if (campaignId) setSearch({ campaignId });
                }}
              >
                Xóa bộ lọc
              </Button>
            )}
          </div>
        </form>
      </section>

      {search !== null && (
        <section className="workflow-card" aria-labelledby="checkin-results">
          <h2 id="checkin-results">
            {campaignId ? 'Danh sách người hiến trong đợt' : 'Kết quả'}
          </h2>
          <QueryState {...results} />
          {results.data && results.data.length === 0 && (
            <p className="workflow-empty">
              {campaignId
                ? 'Chưa có người đăng ký nào trong đợt hiến này khớp với thông tin tìm kiếm.'
                : 'Không tìm thấy đăng ký phù hợp. Kiểm tra lại mã, CCCD hoặc số điện thoại.'}
            </p>
          )}
          <ul className="workflow-list">
            {results.data?.map((registration) => (
              <li
                key={registration.id}
                className="workflow-list__item"
                style={{ cursor: 'pointer' }}
                onClick={(e) => {
                  if ((e.target as HTMLElement).tagName !== 'BUTTON') {
                    setSelected(registration);
                  }
                }}
              >
                <div>
                  <h3 style={{ color: 'var(--color-primary, #0284c7)', marginBottom: '4px' }}>
                    {registration.donorName}
                  </h3>
                  <p className="workflow-muted">
                    {registration.code} · {registration.campaignName}
                  </p>
                  <p className="workflow-muted">
                    {formatSlotRange(
                      registration.slotStartsAt,
                      registration.slotEndsAt,
                    )}
                  </p>
                </div>
                <div className="workflow-list__side">
                  <StatusPill tone={statusTone(registration)}>
                    {registration.checkedInAt
                      ? 'Đã check-in'
                      : REGISTRATION_STATUS_LABELS[registration.status]}
                  </StatusPill>
                  <Button
                    variant="secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelected(registration);
                    }}
                  >
                    Chọn
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {selected && (
        <CheckInModal
          selected={selected}
          onClose={() => setSelected(null)}
          canCheckIn={canCheckIn}
          onCheckIn={confirmCheckIn}
          onNoShow={confirmNoShow}
          pending={mutation.pending}
          error={mutation.error}
          success={mutation.success}
          supportNoShow={Boolean(workflow.markNoShow)}
        />
      )}
    </WorkflowShell>
  );
}

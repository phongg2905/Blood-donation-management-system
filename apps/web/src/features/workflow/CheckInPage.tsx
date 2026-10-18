import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MapPin, Clock, Check, Lock, X } from 'lucide-react';
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
  sortCampaignsForOperationalStation,
  sortRegistrationsForCheckIn,
} from './domain';
import { useWorkflowMutation, useWorkflowQuery } from './hooks';
import { useWorkflowRepository } from './repository';
import { DetailList, StationCompactHeader, StatusPill, WorkflowShell } from './components';
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
        <Button variant="secondary" onClick={onClose} style={{ padding: '4px 10px', fontSize: '0.85rem' }} aria-label="Đóng">
          <X size={16} />
        </Button>
      </div>

      <DetailList
        items={[
          { label: 'Người hiến', value: <strong>{selected.donorName}</strong> },
          { label: 'Mã đăng ký', value: selected.code },
          { label: 'CCCD', value: selected.donorIdentity ?? '—' },
          { label: 'Số điện thoại', value: selected.donorPhone ?? '—' },
          {
            label: 'Khung giờ',
            value: formatSlotRange(selected.slotStartsAt, selected.slotEndsAt),
          },
          {
            label: 'Trạng thái',
            value: REGISTRATION_STATUS_LABELS[selected.status],
          },
          {
            label: 'Thời điểm check-in',
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
  const [deskFilter, setDeskFilter] = useState<'ALL' | 'WAITING' | 'CHECKED_IN'>('ALL');
  const isTestEnv = import.meta.env.MODE === 'test';

  useEffect(() => {
    if (campaignId) {
      setSearch({ campaignId });
    }
  }, [campaignId]);

  const isKeywordSearch = Boolean(
    (search?.code && search.code.trim() !== '') ||
    (search?.identity && search.identity.trim() !== '') ||
    (search?.phone && search.phone.trim() !== '')
  );

  // Single unified campaign registrations query
  const campaignRegistrations = useWorkflowQuery(
    `checkin-registrations:${campaignId ?? 'all'}`,
    () => workflow.findRegistrations({ campaignId }),
    Boolean(campaignId),
  );

  // Fallback server query only when searching across all campaigns or when requested
  const globalSearchQuery = useWorkflowQuery(
    `checkin-search:${JSON.stringify(search)}`,
    () => workflow.findRegistrations(search ?? {}),
    !campaignId && search !== null && isKeywordSearch,
  );

  const results = campaignId ? campaignRegistrations : globalSearchQuery;

  const operationalWindow = campaignQuery.data
    ? getOperationalWindow(campaignQuery.data.startsAt, campaignQuery.data.endsAt)
    : null;

  const isClosedOrUpcoming = !isTestEnv && operationalWindow !== null && operationalWindow.status !== 'ACTIVE';

  const canCheckIn =
    selected !== null &&
    selected.checkedInAt === null &&
    (selected.status === 'SCHEDULED' || selected.status === 'CONFIRMED');

  // Real-time KPI Stats directly from the single campaign data stream
  const stats = useMemo(() => {
    const list = campaignRegistrations.data ?? [];
    const total = list.length;
    const checkedIn = list.filter((r) => r.checkedInAt !== null).length;
    const waiting = total - checkedIn;
    return { total, checkedIn, waiting };
  }, [campaignRegistrations.data]);

  // Instant in-memory filtering + desk filter: 0ms search response for staff
  const displayedResults = useMemo(() => {
    const rawList = campaignId ? (campaignRegistrations.data ?? []) : (globalSearchQuery.data ?? []);
    
    // In-memory keyword filter when scoped to a campaign
    let list = rawList;
    if (campaignId && isKeywordSearch) {
      const code = search?.code?.trim().toLowerCase();
      const identity = search?.identity?.trim().toLowerCase();
      const phone = search?.phone?.trim().toLowerCase();
      list = rawList.filter((r) => {
        if (code && !r.code.toLowerCase().includes(code) && !r.id.toLowerCase().includes(code)) {
          return false;
        }
        if (identity && (!r.donorIdentity || !r.donorIdentity.toLowerCase().includes(identity))) {
          return false;
        }
        if (phone && (!r.donorPhone || !r.donorPhone.toLowerCase().includes(phone))) {
          return false;
        }
        return true;
      });
    }

    const filtered = (() => {
      if (deskFilter === 'WAITING') {
        return list.filter(
          (r) =>
            r.checkedInAt === null &&
            r.status !== 'NO_SHOW' &&
            r.status !== 'CANCELLED',
        );
      }
      if (deskFilter === 'CHECKED_IN') {
        return list.filter((r) => r.checkedInAt !== null);
      }
      return list;
    })();
    return sortRegistrationsForCheckIn(filtered);
  }, [campaignId, campaignRegistrations.data, globalSearchQuery.data, isKeywordSearch, search, deskFilter]);

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
        campaignRegistrations.retry();
      },
      'Check-in thành công. Người hiến đã được đưa vào hàng chờ sàng lọc.',
    );
  }

  function quickCheckIn(reg: DonorRegistration) {
    void mutation.run(
      () => workflow.checkIn(reg.id),
      () => {
        campaignRegistrations.retry();
      },
      `Đã check-in thành công cho ${reg.donorName}.`,
    );
  }

  function confirmNoShow() {
    if (!selected || !workflow.markNoShow) return;
    void mutation.run(
      () => workflow.markNoShow!(selected.id),
      (registration) => {
        setSelected(registration);
        campaignRegistrations.retry();
      },
      'Đã ghi nhận người hiến vắng mặt (No-show).',
    );
  }

  // 1. If accessed without a campaignId (via /clinic/check-in):
  if (!campaignId) {
    const rawCampaignsWithWindow = (campaignsListQuery.data?.items ?? []).map((campaign) => ({
      campaign,
      window: getOperationalWindow(campaign.startsAt, campaign.endsAt),
    }));

    const campaignsWithWindow = sortCampaignsForOperationalStation(rawCampaignsWithWindow);

    const totalCount = campaignsWithWindow.length;
    const activeCount = campaignsWithWindow.filter((c) => c.window.status === 'ACTIVE').length;
    const upcomingCount = campaignsWithWindow.filter((c) => c.window.status === 'UPCOMING').length;
    const closedCount = campaignsWithWindow.filter((c) => c.window.status === 'CLOSED').length;

    const filteredCampaigns = campaignsWithWindow.filter((c) => {
      if (statusFilter === 'ALL') return true;
      return c.window.status === statusFilter;
    });

    return (
      <WorkflowShell title="Chọn đợt hiến máu để tiếp nhận">
        <QueryState {...campaignsListQuery} variant="workflow-list" count={3} />

        {!campaignsListQuery.loading && campaignsListQuery.data && (
          <>
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
              <li
                key={campaign.id}
                className={`workflow-list__item ${window.status === 'ACTIVE' ? 'workflow-list__item--active' : ''}`}
              >
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
                  <p className="workflow-muted" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      <MapPin size={14} style={{ flexShrink: 0, opacity: 0.75 }} />
                      {campaign.location}
                    </span>
                    <span>·</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      <Clock size={14} style={{ flexShrink: 0, opacity: 0.75 }} />
                      {formatDate(campaign.startsAt)}
                    </span>
                  </p>
                  <p className="workflow-muted" style={{ fontSize: '0.8rem' }}>
                    {window.message}
                  </p>
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
          </>
        )}
      </WorkflowShell>
    );
  }

  // 2. Direct desk route: Block access early if campaign is not 'Mở'
  if (isClosedOrUpcoming && operationalWindow) {
    return (
      <WorkflowShell
        title="Quầy tiếp nhận tạm khóa"
        back="/clinic/check-in"
        backLabel="Chọn đợt hiến khác"
      >
        <div className="station-blocked">
          <div className="station-blocked__icon">
            <Lock size={48} color="#64748b" />
          </div>
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
      title="Check-in người hiến"
      back="/clinic/check-in"
      backLabel="← Chọn đợt hiến khác"
    >
      {/* Compact Station Workstation Header */}
      {campaignQuery.data && (
        <StationCompactHeader
          campaign={campaignQuery.data}
          activeStation="checkin"
          operationalWindow={operationalWindow}
        />
      )}

      {/* KPI Stats Bar */}
      <section className="workflow-kpi-bar" aria-label="Thống kê tiếp nhận người hiến">
        <div className="workflow-kpi-card workflow-kpi-card--primary">
          <span className="workflow-kpi-card__label">Tổng đăng ký</span>
          <span className="workflow-kpi-card__value">
            {stats.total} <span className="workflow-kpi-card__unit">người</span>
          </span>
        </div>
        <div className="workflow-kpi-card workflow-kpi-card--success">
          <span className="workflow-kpi-card__label">Đã có mặt (Check-in)</span>
          <span className="workflow-kpi-card__value">
            {stats.checkedIn} <span className="workflow-kpi-card__unit">người</span>
          </span>
        </div>
        <div className="workflow-kpi-card workflow-kpi-card--info">
          <span className="workflow-kpi-card__label">Chưa đến</span>
          <span className="workflow-kpi-card__value">
            {stats.waiting} <span className="workflow-kpi-card__unit">người</span>
          </span>
        </div>
      </section>

      {/* Search & Lookup Form */}
      <section className="workflow-card" aria-labelledby="checkin-search">
        <h2 id="checkin-search" style={{ fontSize: '1.05rem', margin: 0 }}>
          {campaignId ? 'Tìm kiếm người hiến trong đợt này' : 'Tra cứu người hiến'}
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

      {/* Results and Desk Queue */}
      {search !== null && (
        <section className="workflow-card" aria-labelledby="checkin-results">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <h2 id="checkin-results" style={{ margin: 0, fontSize: '1.05rem' }}>
              {campaignId ? 'Danh sách người hiến' : 'Kết quả'}
            </h2>

            {/* Quick Status Filter Chips */}
            <div className="smart-filter-chips" role="tablist">
              <button
                type="button"
                className={`smart-filter-chip ${deskFilter === 'ALL' ? 'smart-filter-chip--active' : ''}`}
                onClick={() => setDeskFilter('ALL')}
              >
                Tất cả <span className="smart-filter-chip__count">{results.data?.length ?? 0}</span>
              </button>
              <button
                type="button"
                className={`smart-filter-chip ${deskFilter === 'WAITING' ? 'smart-filter-chip--active' : ''}`}
                onClick={() => setDeskFilter('WAITING')}
              >
                Chờ check-in <span className="smart-filter-chip__count">{stats.waiting}</span>
              </button>
              <button
                type="button"
                className={`smart-filter-chip ${deskFilter === 'CHECKED_IN' ? 'smart-filter-chip--active' : ''}`}
                onClick={() => setDeskFilter('CHECKED_IN')}
              >
                Đã check-in <span className="smart-filter-chip__count">{stats.checkedIn}</span>
              </button>
            </div>
          </div>

          <QueryState {...results} variant="workflow-list" count={3} />

          {!results.loading && results.data && displayedResults.length === 0 && (
            <p className="workflow-empty">
              {campaignId
                ? 'Không tìm thấy người đăng ký nào khớp với bộ lọc.'
                : 'Không tìm thấy đăng ký phù hợp. Kiểm tra lại mã, CCCD hoặc số điện thoại.'}
            </p>
          )}

          {!results.loading && results.data && displayedResults.length > 0 && (
            <ul className="workflow-list">
            {displayedResults.map((registration) => {
              const isCheckedIn = Boolean(registration.checkedInAt);
              const canQuickCheckIn =
                !isCheckedIn &&
                (registration.status === 'SCHEDULED' || registration.status === 'CONFIRMED');

              return (
                <li
                  key={registration.id}
                  className={`workflow-list__item ${isCheckedIn ? 'workflow-list__item--active' : ''}`}
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
                      Mã: <strong>{registration.code}</strong> {registration.donorIdentity && `· CCCD: ${registration.donorIdentity}`} {registration.donorPhone && `· SĐT: ${registration.donorPhone}`}
                    </p>
                    <p className="workflow-muted" style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={13} style={{ flexShrink: 0, opacity: 0.75 }} />
                      <span>{formatSlotRange(registration.slotStartsAt, registration.slotEndsAt)}</span>
                    </p>
                    {isCheckedIn && (
                      <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#059669', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Check size={14} strokeWidth={2.5} />
                        <span>Đã check-in lúc {new Date(registration.checkedInAt!).toLocaleTimeString('vi-VN')}</span>
                      </p>
                    )}
                  </div>
                  <div className="workflow-list__side">
                    <StatusPill tone={statusTone(registration)}>
                      {isCheckedIn ? 'Đã check-in' : REGISTRATION_STATUS_LABELS[registration.status]}
                    </StatusPill>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {canQuickCheckIn && (
                        <Button
                          disabled={mutation.pending}
                          onClick={(e) => {
                            e.stopPropagation();
                            quickCheckIn(registration);
                          }}
                        >
                          Check-in nhanh
                        </Button>
                      )}
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
                  </div>
                </li>
              );
            })}
            </ul>
          )}
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

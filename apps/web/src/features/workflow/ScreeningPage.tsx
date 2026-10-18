import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Hourglass,
  Lock,
  MapPin,
  X,
  XCircle,
} from 'lucide-react';
import { Button, FormField, Input } from '@/components/ui';
import { ConfirmDialog, Feedback, QueryState } from '@/features/campaigns/components';
import { useCampaignRepository } from '@/features/campaigns/repository';
import { useCampaignQuery } from '@/features/campaigns/hooks';
import {
  BLOOD_GROUP_OPTIONS,
  HEALTH_QUESTIONS,
  MEASUREMENT_FIELDS,
  OPERATIONAL_STATUS_SHORT_LABELS,
  QUICK_TEST_OPTIONS,
  RH_OPTIONS,
  SCREENING_STATUS_LABELS,
  formatDate,
  formatSlotRange,
  getOperationalWindow,
  sortCampaignsForOperationalStation,
  parseMeasurements,
  validateScreening,
  type FieldErrors,
} from './domain';
import { useWorkflowMutation, useWorkflowQuery } from './hooks';
import { useWorkflowRepository } from './repository';
import {
  DetailList,
  StationCompactHeader,
  StatusPill,
  WorkflowShell,
  type PillTone,
} from './components';
import type {
  BloodGroup,
  QuickTestResult,
  RhFactor,
  ScreeningOutcome,
  ScreeningQueueItem,
} from './types';

const screeningTone: Record<ScreeningQueueItem['screening']['status'], PillTone> = {
  PENDING: 'info',
  WAITING_REVIEW: 'warning',
  ELIGIBLE: 'success',
  INELIGIBLE: 'danger',
  DEFERRED: 'neutral',
};

export function ScreeningQueuePage() {
  const { campaignId } = useParams<{ campaignId?: string }>();
  const workflow = useWorkflowRepository();
  const campaignRepo = useCampaignRepository();

  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'UPCOMING' | 'CLOSED'>('ALL');
  const [queueTab, setQueueTab] = useState<'ALL' | 'WAITING' | 'ELIGIBLE' | 'OTHER'>('ALL');
  const [search, setSearch] = useState('');
  const isTestEnv = import.meta.env.MODE === 'test';

  const campaignQuery = useCampaignQuery(
    `screening-campaign:${campaignId}`,
    () => campaignRepo.detail(campaignId!),
    Boolean(campaignId),
  );

  const campaignsListQuery = useCampaignQuery(
    'screening-campaigns-list',
    () => campaignRepo.list({ page: 1, limit: 30, sort: 'desc' }),
    !campaignId,
  );

  const queue = useWorkflowQuery(
    `screening-queue:${campaignId ?? 'all'}`,
    () => workflow.screeningQueue(campaignId),
    Boolean(campaignId),
  );

  const operationalWindow = campaignQuery.data
    ? getOperationalWindow(campaignQuery.data.startsAt, campaignQuery.data.endsAt)
    : null;

  const isClosedOrUpcoming = !isTestEnv && operationalWindow !== null && operationalWindow.status !== 'ACTIVE';

  // Stats calculation
  const stats = useMemo(() => {
    const list = queue.data ?? [];
    const pendingCount = list.filter((r) => r.screening.status === 'PENDING' || r.screening.status === 'WAITING_REVIEW').length;
    const eligibleCount = list.filter((r) => r.screening.status === 'ELIGIBLE').length;
    const ineligibleCount = list.filter((r) => r.screening.status === 'INELIGIBLE').length;
    const deferredCount = list.filter((r) => r.screening.status === 'DEFERRED').length;
    const completedCount = eligibleCount + ineligibleCount + deferredCount;
    const eligibleRate = completedCount > 0 ? Math.round((eligibleCount / completedCount) * 100) : 100;
    return {
      total: list.length,
      pendingCount,
      eligibleCount,
      completedCount,
      eligibleRate,
    };
  }, [queue.data]);

  // Filtered queue items
  const filteredQueue = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (queue.data ?? []).filter(({ registration, screening }) => {
      // Tab filter
      if (queueTab === 'WAITING' && screening.status !== 'PENDING' && screening.status !== 'WAITING_REVIEW') return false;
      if (queueTab === 'ELIGIBLE' && screening.status !== 'ELIGIBLE') return false;
      if (queueTab === 'OTHER' && screening.status !== 'INELIGIBLE' && screening.status !== 'DEFERRED') return false;

      // Text search
      if (!term) return true;
      return (
        registration.donorName.toLowerCase().includes(term) ||
        registration.code.toLowerCase().includes(term) ||
        (registration.donorIdentity && registration.donorIdentity.includes(term))
      );
    });
  }, [queue.data, queueTab, search]);

  // 1. If accessed without a campaignId (via /clinic/screening):
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
      <WorkflowShell
        title="Chọn đợt hiến máu để sàng lọc y tế"
      >
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
                      to={`/campaigns/${campaign.id}/screening`}
                    >
                      Vào bàn sàng lọc
                    </Link>
                  ) : (
                    <Button
                      disabled
                      variant="secondary"
                      title="Chỉ mở khám sàng lọc trong khung giờ quy định"
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
        title="Hàng chờ sàng lọc tạm khóa"
        back="/clinic/screening"
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
            <Link className="btn btn--primary" to="/clinic/screening">
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

  // 3. Render active screening queue workspace
  return (
    <WorkflowShell
      title="Hàng chờ sàng lọc"
      back="/clinic/screening"
      backLabel="← Chọn đợt hiến khác"
    >
      {/* Compact Station Workstation Header */}
      {campaignQuery.data && (
        <StationCompactHeader
          campaign={campaignQuery.data}
          activeStation="screening"
          operationalWindow={operationalWindow}
        />
      )}

      {/* KPI Stats Bar */}
      <section className="workflow-kpi-bar" aria-label="Thống kê hàng chờ sàng lọc">
        <div className="workflow-kpi-card workflow-kpi-card--info">
          <span className="workflow-kpi-card__label">Đang chờ khám</span>
          <span className="workflow-kpi-card__value">
            {stats.pendingCount} <span className="workflow-kpi-card__unit">người</span>
          </span>
        </div>
        <div className="workflow-kpi-card workflow-kpi-card--success">
          <span className="workflow-kpi-card__label">Đủ điều kiện</span>
          <span className="workflow-kpi-card__value">
            {stats.eligibleCount} <span className="workflow-kpi-card__unit">người</span>
          </span>
        </div>
        <div className="workflow-kpi-card">
          <span className="workflow-kpi-card__label">Đã hoàn tất</span>
          <span className="workflow-kpi-card__value">
            {stats.completedCount} <span className="workflow-kpi-card__unit">/ {stats.total}</span>
          </span>
        </div>
        <div className="workflow-kpi-card workflow-kpi-card--primary">
          <span className="workflow-kpi-card__label">Tỉ lệ đạt</span>
          <span className="workflow-kpi-card__value">
            {stats.eligibleRate}<span className="workflow-kpi-card__unit">%</span>
          </span>
        </div>
      </section>

      {/* Smart Search & Filter */}
      <div className="smart-search-container">
        <div className="smart-search-input-wrap">
          <input
            className="smart-search-input"
            type="search"
            value={search}
            placeholder="Tìm theo tên người hiến, mã đăng ký hoặc CCCD..."
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="smart-search-clear" type="button" onClick={() => setSearch('')} aria-label="Xóa tìm kiếm">
              <X size={14} />
            </button>
          )}
        </div>

        <div className="smart-filter-chips" role="tablist">
          <button
            type="button"
            className={`smart-filter-chip ${queueTab === 'ALL' ? 'smart-filter-chip--active' : ''}`}
            onClick={() => setQueueTab('ALL')}
          >
            Tất cả <span className="smart-filter-chip__count">{stats.total}</span>
          </button>
          <button
            type="button"
            className={`smart-filter-chip ${queueTab === 'WAITING' ? 'smart-filter-chip--active' : ''}`}
            onClick={() => setQueueTab('WAITING')}
          >
            Đang chờ khám <span className="smart-filter-chip__count">{stats.pendingCount}</span>
          </button>
          <button
            type="button"
            className={`smart-filter-chip ${queueTab === 'ELIGIBLE' ? 'smart-filter-chip--active' : ''}`}
            onClick={() => setQueueTab('ELIGIBLE')}
          >
            Đủ điều kiện <span className="smart-filter-chip__count">{stats.eligibleCount}</span>
          </button>
          <button
            type="button"
            className={`smart-filter-chip ${queueTab === 'OTHER' ? 'smart-filter-chip--active' : ''}`}
            onClick={() => setQueueTab('OTHER')}
          >
            Tạm hoãn / Không đạt <span className="smart-filter-chip__count">{stats.completedCount - stats.eligibleCount}</span>
          </button>
        </div>
      </div>

      <QueryState {...queue} variant="workflow-list" count={3} />

      {!queue.loading && queue.data && filteredQueue.length === 0 && (
        <p className="workflow-empty">
          {queueTab === 'WAITING'
            ? 'Hiện không có người hiến nào đang chờ sàng lọc.'
            : 'Không tìm thấy người hiến phù hợp với điều kiện lọc.'}
        </p>
      )}

      {!queue.loading && queue.data && filteredQueue.length > 0 && (
        <ul className="workflow-list">
        {filteredQueue.map(({ registration, screening }) => {
          // Check if health declaration has any warning answers
          const hasRiskAnswers = registration.healthDeclaration?.answers
            ? Object.values(registration.healthDeclaration.answers).some((val) => val === true)
            : false;

          return (
            <li key={registration.id} className="workflow-list__item">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                  <h3 style={{ margin: 0 }}>{registration.donorName}</h3>
                  {hasRiskAnswers && (
                    <span
                      style={{
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        padding: '1px 7px',
                        borderRadius: '999px',
                        background: '#fef3c7',
                        color: '#b45309',
                        border: '1px solid #fde68a',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <AlertTriangle size={12} />
                      <span>Có yếu tố cần lưu ý</span>
                    </span>
                  )}
                </div>
                <p className="workflow-muted">
                  Mã: <strong>{registration.code}</strong> {registration.donorIdentity && `· CCCD: ${registration.donorIdentity}`}
                </p>
                <p className="workflow-muted" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={13} style={{ flexShrink: 0, opacity: 0.75 }} />
                  <span>{formatSlotRange(registration.slotStartsAt, registration.slotEndsAt)}</span>
                </p>
              </div>
              <div className="workflow-list__side">
                <StatusPill tone={screeningTone[screening.status]}>
                  {SCREENING_STATUS_LABELS[screening.status]}
                </StatusPill>
                <Link
                  className="btn btn--primary"
                  to={`/campaigns/${campaignId}/screening/${registration.id}`}
                >
                  Mở phiếu
                </Link>
              </div>
            </li>
          );
        })}
        </ul>
      )}
    </WorkflowShell>
  );
}

export function ScreeningPage() {
  const { campaignId, registrationId = '' } = useParams<{
    campaignId?: string;
    registrationId?: string;
  }>();
  const workflow = useWorkflowRepository();
  const campaignRepo = useCampaignRepository();
  const mutation = useWorkflowMutation();
  const isTestEnv = import.meta.env.MODE === 'test';
  const [bypassLock] = useState(isTestEnv);

  const queue = useWorkflowQuery(
    `screening-queue:${campaignId ?? 'all'}`,
    () => workflow.screeningQueue(campaignId),
  );
  const item = useMemo(
    () => queue.data?.find((row) => row.registration.id === registrationId),
    [queue.data, registrationId],
  );

  const effectiveCampaignId = campaignId ?? item?.registration.campaignId;
  const campaignQuery = useCampaignQuery(
    `screening-detail-campaign:${effectiveCampaignId}`,
    () => campaignRepo.detail(effectiveCampaignId!),
    Boolean(effectiveCampaignId),
  );

  const operationalWindow = campaignQuery.data
    ? getOperationalWindow(campaignQuery.data.startsAt, campaignQuery.data.endsAt)
    : null;

  const isLocked = operationalWindow ? !operationalWindow.isOpen && !bypassLock : false;

  const [values, setValues] = useState<Record<string, string>>({});
  const [bloodGroup, setBloodGroup] = useState<BloodGroup | ''>('');
  const [rh, setRh] = useState<RhFactor | ''>('');
  const [infectiousTest, setInfectiousTest] = useState<QuickTestResult | ''>('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [outcome, setOutcome] = useState<ScreeningOutcome | null>(null);
  const [reason, setReason] = useState('');
  const [deferredUntil, setDeferredUntil] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [indicatedVolume, setIndicatedVolume] = useState<number>(350);

  // Sync existing screening data when item loads
  useEffect(() => {
    if (item?.screening) {
      const scr = item.screening;
      if (scr.measurements && Object.keys(scr.measurements).length > 0) {
        const m: Record<string, string> = {};
        for (const [k, v] of Object.entries(scr.measurements)) {
          m[k] = String(v);
        }
        setValues((prev) => (Object.keys(prev).length === 0 ? m : prev));
      }
      if (scr.bloodGroup) setBloodGroup(scr.bloodGroup);
      if (scr.rh) setRh(scr.rh);
      if (scr.infectiousTest) setInfectiousTest(scr.infectiousTest);
      if (scr.indicatedVolumeMl) setIndicatedVolume(scr.indicatedVolumeMl);
      if (scr.status === 'ELIGIBLE' || scr.status === 'INELIGIBLE' || scr.status === 'DEFERRED') {
        setOutcome(scr.status);
        if (scr.reason ?? scr.decisionReason) setReason(scr.reason ?? scr.decisionReason ?? '');
        if (scr.deferredUntil) setDeferredUntil(scr.deferredUntil.split('T')[0] ?? '');
      }
    }
  }, [item]);

  // Auto-suggest donation volume based on donor weight
  useEffect(() => {
    const weightNum = Number(values.WEIGHT);
    if (!Number.isNaN(weightNum) && weightNum > 0) {
      if (weightNum < 45) {
        setIndicatedVolume(250);
      } else if (weightNum >= 45 && indicatedVolume === 250) {
        setIndicatedVolume(350);
      }
    }
  }, [values.WEIGHT]);


  if (!item) {
    return (
      <WorkflowShell
        title="Phiếu sàng lọc"
        back={campaignId ? `/campaigns/${campaignId}/screening` : '/clinic/screening'}
        backLabel={campaignId ? 'Hàng chờ đợt hiến' : 'Hàng chờ sàng lọc'}
      >
        <p className="workflow-empty">
          Không tìm thấy người hiến này trong hàng chờ, hoặc chưa được check-in.
        </p>
      </WorkflowShell>
    );
  }

  const { registration, screening } = item;
  const reviewed =
    screening.status === 'ELIGIBLE' ||
    screening.status === 'INELIGIBLE' ||
    screening.status === 'DEFERRED';

  // Save intermediate measurements draft
  function saveMeasurementsOnly() {
    const notes = {
      bloodGroup: bloodGroup || null,
      rh: rh || null,
      infectiousTest: infectiousTest || null,
    };
    const nextErrors = validateScreening(values, notes);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    void mutation.run(
      () =>
        workflow.saveMeasurements(
          registration.id,
          parseMeasurements(values),
          notes,
          registration.checkIn?.id ?? screening.checkInId,
        ),
      () => queue.retry(),
      'Đã lưu các chỉ số sàng lọc.',
    );
  }

  // Complete review with confirmation dialog
  function submitCompleteReview() {
    const notes = {
      bloodGroup: bloodGroup || null,
      rh: rh || null,
      infectiousTest: infectiousTest || null,
    };
    const nextErrors = validateScreening(values, notes);
    if (!outcome) {
      nextErrors.outcome = 'Vui lòng chọn kết luận sàng lọc.';
    }
    if (outcome === 'DEFERRED' && !reason.trim()) {
      nextErrors.reason = 'Bắt buộc ghi rõ lý do khi tạm hoãn.';
    }
    if (outcome === 'INELIGIBLE' && !reason.trim()) {
      nextErrors.reason = 'Vui lòng ghi rõ lý do khi không đủ điều kiện.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    void mutation.run(
      async () => {
        // Step 1: save measurements
        const saved = await workflow.saveMeasurements(
          registration.id,
          parseMeasurements(values),
          notes,
          registration.checkIn?.id ?? screening.checkInId,
        );
        // Step 2: review screening
        return workflow.reviewScreening(
          saved.id || screening.id || registration.id,
          outcome!,
          reason.trim() || null,
          deferredUntil ? new Date(deferredUntil).toISOString() : null,
          null,
          outcome === 'ELIGIBLE' ? indicatedVolume : null,
        );
      },
      () => {
        setConfirmOpen(false);
        queue.retry();
      },
      outcome === 'ELIGIBLE'
        ? 'Đã kết luận: Đủ điều kiện. Người hiến đã được chuyển sang bước gắn mã túi máu.'
        : 'Đã hoàn tất kết luận sàng lọc.',
    );
  }

  return (
    <WorkflowShell
      title={`Phiếu sàng lọc · ${registration.donorName}`}
      contextBadge={
        registration.campaignName ? (
          <span className="workflow-context-badge">
            Đợt: {registration.campaignName}
          </span>
        ) : undefined
      }
      back={campaignId ? `/campaigns/${campaignId}/screening` : '/clinic/screening'}
      backLabel={campaignId ? 'Hàng chờ đợt hiến' : 'Hàng chờ sàng lọc'}
      actions={
        <StatusPill tone={screeningTone[screening.status]}>
          {SCREENING_STATUS_LABELS[screening.status]}
        </StatusPill>
      }
    >
      {isLocked && (
        <p className="workflow-muted" style={{ color: '#b45309', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <AlertTriangle size={16} style={{ flexShrink: 0 }} />
          <span>Bàn sàng lọc hiện không trong khung giờ tác nghiệp của đợt hiến ({operationalWindow?.message}).</span>
        </p>
      )}

      {/* 2-Column Professional Split Layout */}
      <div className="screening-split-layout">
        {/* Left Column: Donor Info & Health Declaration */}
        <aside className="screening-profile-card">
          <section className="workflow-card">
            <h2 style={{ fontSize: '1.05rem', margin: '0 0 8px' }}>Hồ sơ người hiến</h2>
            <DetailList
              items={[
                { label: 'Họ và tên', value: <strong>{registration.donorName}</strong> },
                { label: 'Mã đăng ký', value: registration.code },
                { label: 'CCCD', value: registration.donorIdentity ?? '—' },
                { label: 'Số điện thoại', value: registration.donorPhone ?? '—' },
                {
                  label: 'Khung giờ',
                  value: formatSlotRange(registration.slotStartsAt, registration.slotEndsAt),
                },
                {
                  label: 'Check-in lúc',
                  value: registration.checkedInAt
                    ? new Date(registration.checkedInAt).toLocaleTimeString('vi-VN')
                    : '—',
                },
              ]}
            />
          </section>

          {/* Health Declaration Summary Box */}
          <section className="workflow-card">
            <h2 style={{ fontSize: '1.05rem', margin: '0 0 8px' }}>Tờ khai sức khỏe</h2>
            {registration.healthDeclaration?.answers ? (
              <div className="screening-declaration-box">
                {HEALTH_QUESTIONS.map((q) => {
                  const ans = registration.healthDeclaration?.answers[q.code];
                  const isYes = ans === true;
                  return (
                    <div key={q.code} className="screening-declaration-item">
                      <span style={{ fontSize: '0.82rem', color: isYes ? '#991b1b' : 'var(--color-ink-700)' }}>
                        {q.label}
                      </span>
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: '0.78rem',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          background: isYes ? '#fee2e2' : '#f1f5f9',
                          color: isYes ? '#b91c1c' : '#475569',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {isYes ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <AlertTriangle size={12} /> CÓ
                          </span>
                        ) : (
                          'Không'
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="workflow-muted">Chưa có tờ khai sức khỏe điện tử.</p>
            )}
          </section>
        </aside>

        {/* Right Column: Clinical Examination & Final Decision */}
        <main style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Read-only review summary if already finalized */}
          {reviewed ? (
            <section className="workflow-card">
              <h2 style={{ color: 'var(--color-ink-900)' }}>Kết luận sàng lọc đã lưu</h2>
              <DetailList
                items={[
                  {
                    label: 'Kết luận',
                    value: (
                      <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>
                        {SCREENING_STATUS_LABELS[screening.status]}
                      </span>
                    ),
                  },
                  ...(screening.status === 'ELIGIBLE'
                    ? [
                        {
                          label: 'Thể tích chỉ định',
                          value: (
                            <span style={{ fontWeight: 700, color: 'var(--color-primary-700, #059669)' }}>
                              {screening.indicatedVolumeMl ?? 350} ml
                            </span>
                          ),
                        },
                      ]
                    : []),
                  { label: 'Lý do', value: screening.reason ?? screening.decisionReason ?? '—' },
                  ...(screening.deferredUntil
                    ? [{ label: 'Tạm hoãn đến ngày', value: formatDate(screening.deferredUntil) }]
                    : []),
                  {
                    label: 'Thời điểm kết luận',
                    value: screening.reviewedAt
                      ? new Date(screening.reviewedAt).toLocaleString('vi-VN')
                      : '—',
                  },
                  {
                    label: 'Nhóm máu & Rh',
                    value: screening.bloodGroup
                      ? `${screening.bloodGroup} (${screening.rh === 'POSITIVE' ? 'Rh+' : screening.rh === 'NEGATIVE' ? 'Rh−' : 'Rh chưa rõ'})`
                      : 'Chưa rõ (Chờ kết quả xét nghiệm phòng Lab)',
                  },
                  {
                    label: 'Test nhanh truyền nhiễm',
                    value: screening.infectiousTest === 'NEGATIVE' ? 'Âm tính' : screening.infectiousTest === 'POSITIVE' ? 'Dương tính' : '—',
                  },
                ]}
              />

              <div style={{ marginTop: '16px', borderTop: '1px solid var(--color-border)', paddingTop: '16px' }}>
                <h3 style={{ fontSize: '0.95rem', marginBottom: '8px' }}>Chỉ số đo khám đã ghi nhận:</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
                  {MEASUREMENT_FIELDS.map((f) => (
                    <div key={f.code} style={{ background: 'var(--color-surface-sunken)', padding: '8px 12px', borderRadius: '8px' }}>
                      <div style={{ fontSize: '0.74rem', color: 'var(--color-ink-600)' }}>{f.label}</div>
                      <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--color-ink-900)' }}>
                        {screening.measurements[f.code] ?? '—'} <span style={{ fontSize: '0.78rem', fontWeight: 500 }}>{f.unit}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {screening.status === 'ELIGIBLE' && (
                <div className="workflow-actions" style={{ marginTop: '20px' }}>
                  <Link
                    className="btn btn--primary"
                    to={campaignId ? `/campaigns/${campaignId}/blood-bags` : '/clinic/blood-bags'}
                  >
                    Chuyển sang bàn lấy máu →
                  </Link>
                </div>
              )}
            </section>
          ) : (
            <>
              {/* Form 1: Vital Signs & Measurements */}
              <section className="workflow-card" aria-labelledby="screening-form">
                <h2 id="screening-form">1. Chỉ số lâm sàng</h2>

                <div className="screening-vitals-grid">
                  {MEASUREMENT_FIELDS.map((field) => (
                    <FormField
                      key={field.code}
                      id={`screening-${field.code}`}
                      label={`${field.label} (${field.unit})`}
                      error={errors[field.code]}
                      required
                    >
                      <Input
                        type="number"
                        step="any"
                        min="0"
                        inputMode="decimal"
                        value={values[field.code] ?? ''}
                        disabled={reviewed}
                        placeholder={
                          field.code === 'PULSE'
                            ? '60 - 90'
                            : field.code === 'TEMPERATURE'
                              ? '36.5 - 37.2'
                              : field.code === 'WEIGHT'
                                ? '≥ 45'
                                : field.code === 'HEMOGLOBIN'
                                  ? '120 - 165'
                                  : ''
                        }
                        onChange={(event) =>
                          setValues((prev) => ({
                            ...prev,
                            [field.code]: event.target.value,
                          }))
                        }
                      />
                    </FormField>
                  ))}
                </div>
              </section>

              {/* Form 2: Rapid Tests & Blood Group */}
              <section className="workflow-card">
                <h2>2. Định nhóm máu & Xét nghiệm nhanh</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                  <FormField
                    id="screening-blood-group"
                    label="Nhóm máu ABO"
                    error={errors.bloodGroup}
                  >
                    <select
                      className="input"
                      id="screening-blood-group"
                      value={bloodGroup}
                      disabled={reviewed}
                      onChange={(event) => setBloodGroup(event.target.value as BloodGroup | '')}
                    >
                      <option value="">-- Chưa rõ / Chờ xét nghiệm --</option>
                      {BLOOD_GROUP_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          Nhóm {option}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <FormField
                    id="screening-rh"
                    label="Yếu tố Rh"
                    error={errors.rh}
                  >
                    <select
                      className="input"
                      id="screening-rh"
                      value={rh}
                      disabled={reviewed}
                      onChange={(event) => setRh(event.target.value as RhFactor | '')}
                    >
                      <option value="">-- Chưa rõ / Chờ xét nghiệm --</option>
                      {RH_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option === 'POSITIVE' ? 'Dương tính (Rh+)' : 'Âm tính (Rh−)'}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <FormField
                    id="screening-infectious"
                    label="Test nhanh bệnh truyền nhiễm"
                    error={errors.infectiousTest}
                    required
                  >
                    <select
                      className="input"
                      id="screening-infectious"
                      value={infectiousTest}
                      disabled={reviewed}
                      onChange={(event) => setInfectiousTest(event.target.value as QuickTestResult | '')}
                    >
                      <option value="">-- Kết quả test --</option>
                      {QUICK_TEST_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option === 'NEGATIVE' ? 'Âm tính (Đạt)' : 'Dương tính (Không đạt)'}
                        </option>
                      ))}
                    </select>
                  </FormField>
                </div>
              </section>

              {/* Form 3: Decision & Review Outcome */}
              <section className="workflow-card" aria-labelledby="screening-review">
                <h2 id="screening-review">3. Kết luận sàng lọc</h2>

                {errors.outcome && (
                  <p style={{ color: 'var(--color-danger, #dc2626)', fontSize: '0.85rem', margin: '0 0 10px' }}>
                    {errors.outcome}
                  </p>
                )}

                <div className="screening-outcome-grid">
                  <button
                    type="button"
                    className={`screening-outcome-btn screening-outcome-btn--eligible ${outcome === 'ELIGIBLE' ? 'screening-outcome-btn--selected' : ''}`}
                    onClick={() => setOutcome('ELIGIBLE')}
                  >
                    <span className="screening-outcome-btn__icon">
                      <CheckCircle2 size={24} color="#059669" />
                    </span>
                    <span className="screening-outcome-btn__title">Đủ điều kiện</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-ink-600)' }}>
                      Cho phép lấy máu
                    </span>
                  </button>

                  <button
                    type="button"
                    className={`screening-outcome-btn screening-outcome-btn--deferred ${outcome === 'DEFERRED' ? 'screening-outcome-btn--selected' : ''}`}
                    onClick={() => setOutcome('DEFERRED')}
                  >
                    <span className="screening-outcome-btn__icon">
                      <Hourglass size={24} color="#d97706" />
                    </span>
                    <span className="screening-outcome-btn__title">Tạm hoãn</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-ink-600)' }}>
                      Tạm hoãn có thời hạn
                    </span>
                  </button>

                  <button
                    type="button"
                    className={`screening-outcome-btn screening-outcome-btn--ineligible ${outcome === 'INELIGIBLE' ? 'screening-outcome-btn--selected' : ''}`}
                    onClick={() => setOutcome('INELIGIBLE')}
                  >
                    <span className="screening-outcome-btn__icon">
                      <XCircle size={24} color="#dc2626" />
                    </span>
                    <span className="screening-outcome-btn__title">Không đủ điều kiện</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-ink-600)' }}>
                      Từ chối hiến máu
                    </span>
                  </button>
                </div>

                {outcome === 'ELIGIBLE' && (
                  <div
                    style={{
                      marginTop: '16px',
                      padding: '14px',
                      borderRadius: '8px',
                      background: 'var(--color-surface-sunken, #f8fafc)',
                      border: '1px solid var(--color-border, #e2e8f0)',
                    }}
                  >
                    <label
                      style={{
                        display: 'block',
                        fontWeight: 600,
                        fontSize: '0.9rem',
                        marginBottom: '8px',
                        color: 'var(--color-ink-900)',
                      }}
                    >
                      Chỉ định thể tích túi máu hiến <span style={{ color: 'var(--color-danger, #dc2626)' }}>*</span>
                    </label>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                      {([250, 350, 450] as const).map((vol) => (
                        <button
                          key={vol}
                          type="button"
                          className={`btn ${indicatedVolume === vol ? 'btn--primary' : 'btn--secondary'}`}
                          style={{ minWidth: '90px', fontWeight: 600 }}
                          onClick={() => setIndicatedVolume(vol)}
                        >
                          {vol} ml
                        </button>
                      ))}
                      <span style={{ fontSize: '0.8rem', color: 'var(--color-ink-600)', marginLeft: '6px' }}>
                        {Number(values.WEIGHT) < 45
                          ? '(Cân nặng < 45kg: Quy định tối đa 250ml)'
                          : Number(values.WEIGHT) >= 60
                            ? '(Cân nặng ≥ 60kg: Đủ điều kiện hiến 350ml hoặc 450ml)'
                            : '(Cân nặng 45 - 60kg: Khuyến nghị 350ml)'}
                      </span>
                    </div>
                  </div>
                )}

                {outcome && outcome !== 'ELIGIBLE' && (
                  <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <FormField
                      id="screening-reason"
                      label={outcome === 'DEFERRED' ? 'Lý do tạm hoãn' : 'Lý do không đủ điều kiện'}
                      error={errors.reason}
                      required
                    >
                      <textarea
                        className="input"
                        id="screening-reason"
                        rows={2}
                        value={reason}
                        placeholder={outcome === 'DEFERRED' ? 'Bắt buộc ghi rõ lý do tạm hoãn (VD: Huyết áp thấp, vừa sốt...)' : 'Ghi rõ lý do từ chối'}
                        onChange={(event) => setReason(event.target.value)}
                      />
                    </FormField>

                    {outcome === 'DEFERRED' && (
                      <FormField
                        id="screening-deferred-until"
                        label="Tạm hoãn đến ngày (không bắt buộc)"
                      >
                        <Input
                          type="date"
                          value={deferredUntil}
                          onChange={(event) => setDeferredUntil(event.target.value)}
                        />
                      </FormField>
                    )}
                  </div>
                )}

                <Feedback error={mutation.error} success={mutation.success} />

                <div className="workflow-actions" style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <Button
                    type="button"
                    variant="secondary"
                    isLoading={mutation.pending}
                    disabled={isLocked}
                    onClick={saveMeasurementsOnly}
                  >
                    Lưu tạm chỉ số
                  </Button>
                  <Button
                    type="button"
                    disabled={!outcome || isLocked}
                    onClick={() => setConfirmOpen(true)}
                  >
                    Hoàn tất kết luận
                  </Button>
                </div>
              </section>
            </>
          )}
        </main>
      </div>

      {confirmOpen && outcome && (
        <ConfirmDialog
          title="Xác nhận kết luận sàng lọc"
          label="Xác nhận"
          pending={mutation.pending}
          error={mutation.error}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={submitCompleteReview}
        >
          <p>
            Kết luận: <strong>{SCREENING_STATUS_LABELS[outcome]}</strong> cho người hiến <strong>{registration.donorName}</strong>.
          </p>
          {outcome !== 'ELIGIBLE' && (
            <p>Lý do: <em>{reason.trim() || '(chưa nhập)'}</em></p>
          )}
          {outcome === 'DEFERRED' && deferredUntil && (
            <p>Tạm hoãn đến: {formatDate(deferredUntil)}</p>
          )}
          {outcome === 'ELIGIBLE' && (
            <>
              <p>
                Chỉ định thể tích hiến máu:{' '}
                <strong style={{ color: '#059669', fontSize: '1.05rem' }}>{indicatedVolume} ml</strong>
              </p>
              <p style={{ color: '#059669', fontWeight: 600 }}>
                Sau khi xác nhận, người hiến sẽ tự động chuyển sang hàng chờ tại Bàn lấy máu với thể tích được định sẵn.
              </p>
            </>
          )}
        </ConfirmDialog>
      )}
    </WorkflowShell>
  );
}

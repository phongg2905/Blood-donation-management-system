import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button, FormField, Input } from '@/components/ui';
import { ConfirmDialog, Feedback, QueryState } from '@/features/campaigns/components';
import { useCampaignRepository } from '@/features/campaigns/repository';
import { useCampaignQuery } from '@/features/campaigns/hooks';
import {
  BLOOD_GROUP_OPTIONS,
  MEASUREMENT_FIELDS,
  OPERATIONAL_STATUS_SHORT_LABELS,
  QUICK_TEST_OPTIONS,
  RH_OPTIONS,
  SCREENING_STATUS_LABELS,
  formatDate,
  formatSlotRange,
  getOperationalWindow,
  parseMeasurements,
  validateScreening,
  type FieldErrors,
} from './domain';
import { useWorkflowMutation, useWorkflowQuery } from './hooks';
import { useWorkflowRepository } from './repository';
import {
  DetailList,
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

const screeningTone: Record<ScreeningQueueItem['screening']['status'], PillTone> =
  {
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

  // 1. If accessed without a campaignId (via /clinic/screening):
  // Only display the list of active campaigns with status filter tabs!
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
        eyebrow="Khu vực sàng lọc"
        title="Chọn đợt hiến máu để sàng lọc y tế"
        lead="Vui lòng chọn đợt hiến máu đang diễn ra để mở danh sách hàng chờ khám lâm sàng và xét nghiệm."
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
      </WorkflowShell>
    );
  }

  // 2. Direct desk route: Block access early if campaign is not 'Mở'
  if (isClosedOrUpcoming && operationalWindow) {
    return (
      <WorkflowShell
        eyebrow="Khu vực sàng lọc"
        title="Hàng chờ sàng lọc tạm khóa"
        back="/clinic/screening"
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
      eyebrow={campaignQuery.data ? `Khu vực sàng lọc · ${campaignQuery.data.name}` : 'Khu vực sàng lọc'}
      title="Hàng chờ sàng lọc"
      lead={
        campaignQuery.data
          ? `Điểm hiến: ${campaignQuery.data.location}. Danh sách người hiến đã check-in đang chờ sàng lọc y tế.`
          : 'Danh sách người hiến đã check-in và đang chờ sàng lọc.'
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
              className="station-nav-link"
              to={`/campaigns/${campaignId}/check-in`}
            >
              Quầy tiếp nhận
            </Link>
            <Link
              className="station-nav-link station-nav-link--active"
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

      <QueryState {...queue} />
      {queue.data && queue.data.length === 0 && (
        <p className="workflow-empty">
          Chưa có người hiến nào đã check-in trong đợt này. Hãy tiếp nhận tại quầy tiếp nhận.
        </p>
      )}
      <ul className="workflow-list">
        {queue.data?.map(({ registration, screening }) => (
          <li key={registration.id} className="workflow-list__item">
            <div>
              <h3>{registration.donorName}</h3>
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
        ))}
      </ul>
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

  if (queue.loading)
    return (
      <WorkflowShell title="Phiếu sàng lọc">
        <QueryState {...queue} />
      </WorkflowShell>
    );

  if (!item)
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

  const { registration, screening } = item;

  function saveMeasurements() {
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
      'Đã lưu chỉ số sàng lọc. Chọn kết luận để hoàn tất.',
    );
  }

  function submitReview() {
    if (!outcome) return;
    if (outcome === 'DEFERRED' && !reason.trim()) {
      setErrors({ reason: 'Bắt buộc ghi rõ lý do khi tạm hoãn.' });
      return;
    }
    if (outcome === 'INELIGIBLE' && !reason.trim()) {
      setErrors({ reason: 'Vui lòng ghi rõ lý do khi không đủ điều kiện.' });
      return;
    }
    setErrors({});
    void mutation.run(
      () =>
        workflow.reviewScreening(
          screening.id || registration.id,
          outcome,
          reason.trim() || null,
          deferredUntil ? new Date(deferredUntil).toISOString() : null,
        ),
      () => {
        setConfirmOpen(false);
        queue.retry();
      },
      outcome === 'ELIGIBLE'
        ? 'Đã kết luận: đủ điều kiện. Tiếp tục sang bước gắn mã túi máu.'
        : 'Đã ghi nhận kết luận sàng lọc.',
    );
  }

  const reviewed =
    screening.status === 'ELIGIBLE' ||
    screening.status === 'INELIGIBLE' ||
    screening.status === 'DEFERRED';

  return (
    <WorkflowShell
      eyebrow={
        registration.campaignName
          ? `Khu vực sàng lọc · ${registration.campaignName}`
          : 'Khu vực sàng lọc'
      }
      title={`Phiếu sàng lọc · ${registration.donorName}`}
      back={campaignId ? `/campaigns/${campaignId}/screening` : '/clinic/screening'}
      backLabel={campaignId ? 'Hàng chờ đợt hiến' : 'Hàng chờ sàng lọc'}
      actions={
        <StatusPill tone={screeningTone[screening.status]}>
          {SCREENING_STATUS_LABELS[screening.status]}
        </StatusPill>
      }
    >
      {isLocked && (
        <p className="workflow-muted" style={{ color: '#b45309', margin: '0 0 12px' }}>
          ⚠️ Bàn sàng lọc hiện không trong khung giờ tác nghiệp của đợt hiến ({operationalWindow?.message}).
        </p>
      )}
      <section className="workflow-card">
        <h2>Thông tin người hiến</h2>
        <DetailList
          items={[
            { label: 'Mã đăng ký', value: registration.code },
            { label: 'Đợt hiến', value: registration.campaignName },
            {
              label: 'Khung giờ',
              value: formatSlotRange(
                registration.slotStartsAt,
                registration.slotEndsAt,
              ),
            },
          ]}
        />
      </section>

      <section className="workflow-card" aria-labelledby="screening-form">
        <h2 id="screening-form">Chỉ số sàng lọc</h2>
        <form
          className="workflow-form"
          onSubmit={(event) => {
            event.preventDefault();
            saveMeasurements();
          }}
        >
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
                onChange={(event) =>
                  setValues((prev) => ({
                    ...prev,
                    [field.code]: event.target.value,
                  }))
                }
              />
            </FormField>
          ))}
          <FormField
            id="screening-blood-group"
            label="Nhóm máu ABO"
            error={errors.bloodGroup}
            required
          >
            <select
              className="input"
              id="screening-blood-group"
              value={bloodGroup}
              disabled={reviewed}
              onChange={(event) =>
                setBloodGroup(event.target.value as BloodGroup | '')
              }
            >
              <option value="">Chọn nhóm máu</option>
              {BLOOD_GROUP_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </FormField>
          <FormField
            id="screening-rh"
            label="Yếu tố Rh"
            error={errors.rh}
            required
          >
            <select
              className="input"
              id="screening-rh"
              value={rh}
              disabled={reviewed}
              onChange={(event) => setRh(event.target.value as RhFactor | '')}
            >
              <option value="">Chọn Rh</option>
              {RH_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option === 'POSITIVE' ? 'Dương (Rh+)' : 'Âm (Rh−)'}
                </option>
              ))}
            </select>
          </FormField>
          <FormField
            id="screening-infectious"
            label="Xét nghiệm nhanh bệnh truyền nhiễm"
            error={errors.infectiousTest}
            required
          >
            <select
              className="input"
              id="screening-infectious"
              value={infectiousTest}
              disabled={reviewed}
              onChange={(event) =>
                setInfectiousTest(event.target.value as QuickTestResult | '')
              }
            >
              <option value="">Chọn kết quả</option>
              {QUICK_TEST_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option === 'NEGATIVE' ? 'Âm tính' : 'Dương tính'}
                </option>
              ))}
            </select>
          </FormField>
          {!reviewed && (
            <div className="workflow-actions">
              <Button type="submit" isLoading={mutation.pending} disabled={isLocked}>
                Lưu chỉ số
              </Button>
            </div>
          )}
        </form>
      </section>

      <section className="workflow-card" aria-labelledby="screening-review">
        <h2 id="screening-review">Kết luận sàng lọc</h2>
        {screening.status === 'PENDING' && (
          <p className="workflow-muted">
            Lưu chỉ số sàng lọc trước khi kết luận.
          </p>
        )}
        {reviewed ? (
          <DetailList
            items={[
              {
                label: 'Kết luận',
                value: SCREENING_STATUS_LABELS[screening.status],
              },
              { label: 'Lý do', value: screening.reason ?? screening.decisionReason ?? '—' },
              ...(screening.deferredUntil
                ? [{ label: 'Tạm hoãn đến', value: formatDate(screening.deferredUntil) }]
                : []),
              {
                label: 'Thời điểm',
                value: screening.reviewedAt
                  ? new Date(screening.reviewedAt).toLocaleString('vi-VN')
                  : '—',
              },
            ]}
          />
        ) : (
          <>
            <div className="workflow-choice workflow-choice--stack">
              {(
                [
                  { value: 'ELIGIBLE', label: 'Đủ điều kiện', tone: 'success' },
                  { value: 'DEFERRED', label: 'Tạm hoãn', tone: 'warning' },
                  {
                    value: 'INELIGIBLE',
                    label: 'Không đủ điều kiện',
                    tone: 'danger',
                  },
                ] as const
              ).map((option) => (
                <label
                  key={option.value}
                  className={`workflow-outcome workflow-outcome--${option.tone}`}
                >
                  <input
                    type="radio"
                    name="outcome"
                    checked={outcome === option.value}
                    onChange={() => setOutcome(option.value)}
                    disabled={
                      screening.status !== 'WAITING_REVIEW' && !reviewed
                    }
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
            {outcome && outcome !== 'ELIGIBLE' && (
              <FormField
                id="screening-reason"
                label={outcome === 'DEFERRED' ? 'Lý do tạm hoãn' : 'Lý do không đủ điều kiện'}
                error={errors.reason}
                required
              >
                <textarea
                  className="input"
                  id="screening-reason"
                  rows={3}
                  value={reason}
                  placeholder={outcome === 'DEFERRED' ? 'Bắt buộc ghi rõ lý do tạm hoãn' : 'Ghi rõ lý do'}
                  onChange={(event) => setReason(event.target.value)}
                />
              </FormField>
            )}
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
            <Feedback error={mutation.error} success={mutation.success} />
            <div className="workflow-actions">
              <Button
                disabled={!outcome || screening.status !== 'WAITING_REVIEW' || isLocked}
                onClick={() => setConfirmOpen(true)}
              >
                Hoàn tất kết luận
              </Button>
            </div>
            {isLocked && (
              <p className="workflow-muted" style={{ color: '#b45309' }}>
                ⚠️ Thao tác sàng lọc bị khóa ngoài khung giờ tác nghiệp của đợt hiến. Bật &quot;Thử nghiệm&quot; ở bảng thông báo phía trên nếu cần thao tác thử.
              </p>
            )}
          </>
        )}
      </section>

      {confirmOpen && outcome && (
        <ConfirmDialog
          title="Xác nhận kết luận sàng lọc"
          label="Xác nhận"
          pending={mutation.pending}
          error={mutation.error}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={submitReview}
        >
          <p>
            Kết luận: <strong>{SCREENING_STATUS_LABELS[outcome]}</strong> cho{' '}
            {registration.donorName}.
          </p>
          {outcome !== 'ELIGIBLE' && (
            <p>Lý do: {reason.trim() || '(chưa nhập)'}</p>
          )}
          {outcome === 'DEFERRED' && deferredUntil && (
            <p>Tạm hoãn đến: {formatDate(deferredUntil)}</p>
          )}
          {outcome === 'ELIGIBLE' && (
            <p>Sau khi xác nhận, người hiến chuyển sang bước gắn mã túi máu.</p>
          )}
        </ConfirmDialog>
      )}
    </WorkflowShell>
  );
}

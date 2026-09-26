import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button, FormField, Input } from '@/components/ui';
import { ConfirmDialog, Feedback, QueryState } from '@/features/campaigns/components';
import {
  BLOOD_GROUP_OPTIONS,
  MEASUREMENT_FIELDS,
  QUICK_TEST_OPTIONS,
  RH_OPTIONS,
  SCREENING_STATUS_LABELS,
  formatSlotRange,
  parseMeasurements,
  validateScreening,
  type FieldErrors,
} from './domain';
import { useWorkflowMutation, useWorkflowQuery } from './hooks';
import { useWorkflowRepository } from './repository';
import {
  DetailList,
  MockNote,
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
  const workflow = useWorkflowRepository();
  const queue = useWorkflowQuery('screening-queue', () =>
    workflow.screeningQueue(),
  );

  return (
    <WorkflowShell
      eyebrow="Khu vực sàng lọc"
      title="Hàng chờ sàng lọc"
      lead="Danh sách người hiến đã check-in và đang chờ sàng lọc."
    >
      <MockNote />
      <QueryState {...queue} />
      {queue.data && queue.data.length === 0 && (
        <p className="workflow-empty">
          Chưa có người hiến nào đã check-in. Hãy check-in ở quầy tiếp nhận.
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
                to={`/clinic/screening/${registration.id}`}
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
  const { registrationId = '' } = useParams();
  const workflow = useWorkflowRepository();
  const mutation = useWorkflowMutation();
  const queue = useWorkflowQuery('screening-queue', () =>
    workflow.screeningQueue(),
  );
  const item = useMemo(
    () => queue.data?.find((row) => row.registration.id === registrationId),
    [queue.data, registrationId],
  );

  const [values, setValues] = useState<Record<string, string>>({});
  const [bloodGroup, setBloodGroup] = useState<BloodGroup | ''>('');
  const [rh, setRh] = useState<RhFactor | ''>('');
  const [infectiousTest, setInfectiousTest] = useState<QuickTestResult | ''>('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [outcome, setOutcome] = useState<ScreeningOutcome | null>(null);
  const [reason, setReason] = useState('');
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
        back="/clinic/screening"
        backLabel="Hàng chờ sàng lọc"
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
      () => workflow.saveMeasurements(registration.id, parseMeasurements(values), notes),
      () => queue.retry(),
      'Đã lưu chỉ số sàng lọc. Chọn kết luận để hoàn tất.',
    );
  }

  function submitReview() {
    if (!outcome) return;
    if (outcome !== 'ELIGIBLE' && !reason.trim()) {
      setErrors({ reason: 'Vui lòng ghi rõ lý do khi không đủ điều kiện.' });
      return;
    }
    setErrors({});
    void mutation.run(
      () => workflow.reviewScreening(registration.id, outcome, reason.trim() || null),
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
      eyebrow="Khu vực sàng lọc"
      title={`Phiếu sàng lọc · ${registration.donorName}`}
      back="/clinic/screening"
      backLabel="Hàng chờ sàng lọc"
      actions={
        <StatusPill tone={screeningTone[screening.status]}>
          {SCREENING_STATUS_LABELS[screening.status]}
        </StatusPill>
      }
    >
      <MockNote />
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
              <Button type="submit" isLoading={mutation.pending}>
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
              { label: 'Lý do', value: screening.reason ?? '—' },
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
                label="Lý do"
                error={errors.reason}
                required
              >
                <textarea
                  className="input"
                  id="screening-reason"
                  rows={3}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
              </FormField>
            )}
            <Feedback error={mutation.error} success={mutation.success} />
            <div className="workflow-actions">
              <Button
                disabled={!outcome || screening.status !== 'WAITING_REVIEW'}
                onClick={() => setConfirmOpen(true)}
              >
                Hoàn tất kết luận
              </Button>
            </div>
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
          {outcome === 'ELIGIBLE' && (
            <p>Sau khi xác nhận, người hiến chuyển sang bước gắn mã túi máu.</p>
          )}
        </ConfirmDialog>
      )}
    </WorkflowShell>
  );
}

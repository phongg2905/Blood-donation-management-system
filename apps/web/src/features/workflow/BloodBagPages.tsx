import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BLOOD_BAG_STATUSES, type BloodBagStatus } from '@blood/shared-types';
import { Button, FormField, Input } from '@/components/ui';
import { Feedback, QueryState } from '@/features/campaigns/components';
import {
  BLOOD_BAG_STATUS_LABELS,
  formatDateTime,
  toBackendBloodType,
  validateBloodBag,
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
import type { BloodBag, ScreeningQueueItem } from './types';

const bagTone: Record<BloodBagStatus, PillTone> = {
  CREATED: 'neutral',
  COLLECTED: 'info',
  PENDING_TEST: 'warning',
  TESTED: 'info',
  ACCEPTED: 'success',
  REJECTED: 'danger',
  DISCARDED: 'neutral',
};

export function BloodBagsPage() {
  const workflow = useWorkflowRepository();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<BloodBagStatus | ''>('');
  const bags = useWorkflowQuery('blood-bags', () => workflow.bloodBags());

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('vi');
    return (bags.data ?? []).filter((bag) => {
      if (status && bag.status !== status) return false;
      if (!term) return true;
      return `${bag.code} ${bag.donorName} ${bag.campaignName}`
        .toLocaleLowerCase('vi')
        .includes(term);
    });
  }, [bags.data, search, status]);

  return (
    <WorkflowShell
      eyebrow="Quản lý túi máu"
      title="Túi máu đã tiếp nhận"
      lead="Danh sách túi máu ghi nhận từ các ca hiến. Màn hình này chỉ quản lý túi máu, không theo dõi quá trình lấy máu."
      actions={
        <Link className="btn btn--primary" to="/clinic/blood-bags/new">
          Gắn mã túi máu
        </Link>
      }
    >
      <MockNote />
      <form
        className="workflow-form workflow-form--inline"
        onSubmit={(event) => event.preventDefault()}
      >
        <FormField id="bag-search" label="Tìm kiếm">
          <Input
            type="search"
            value={search}
            placeholder="Mã túi, người hiến hoặc đợt hiến"
            onChange={(event) => setSearch(event.target.value)}
          />
        </FormField>
        <FormField id="bag-status" label="Trạng thái">
          <select
            className="input"
            id="bag-status"
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as BloodBagStatus | '')
            }
          >
            <option value="">Tất cả trạng thái</option>
            {BLOOD_BAG_STATUSES.map((option) => (
              <option key={option} value={option}>
                {BLOOD_BAG_STATUS_LABELS[option]}
              </option>
            ))}
          </select>
        </FormField>
      </form>

      <QueryState {...bags} />
      {bags.data && filtered.length === 0 && (
        <p className="workflow-empty">Không có túi máu nào phù hợp.</p>
      )}
      {filtered.length > 0 && (
        <div className="workflow-table-wrap">
          <table className="workflow-table">
            <caption className="visually-hidden">
              Danh sách túi máu đã tiếp nhận
            </caption>
            <thead>
              <tr>
                <th scope="col">Mã túi</th>
                <th scope="col">Người hiến</th>
                <th scope="col">Đợt hiến</th>
                <th scope="col">Thể tích</th>
                <th scope="col">Nhóm máu</th>
                <th scope="col">Trạng thái</th>
                <th scope="col">Tiếp nhận</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((bag) => (
                <tr key={bag.id}>
                  <th scope="row">{bag.code}</th>
                  <td>{bag.donorName}</td>
                  <td>{bag.campaignName}</td>
                  <td>{bag.volumeMl} ml</td>
                  <td>{bag.bloodGroup ?? '—'}</td>
                  <td>
                    <StatusPill tone={bagTone[bag.status]}>
                      {BLOOD_BAG_STATUS_LABELS[bag.status]}
                    </StatusPill>
                  </td>
                  <td>{formatDateTime(bag.receivedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </WorkflowShell>
  );
}

export function NewBloodBagPage() {
  const workflow = useWorkflowRepository();
  const navigate = useNavigate();
  const mutation = useWorkflowMutation();
  const eligible = useWorkflowQuery('eligible-for-bag', () =>
    workflow.eligibleForBag(),
  );
  const [selected, setSelected] = useState<ScreeningQueueItem | null>(null);
  const [code, setCode] = useState('');
  const [volume, setVolume] = useState('350');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [created, setCreated] = useState<BloodBag | null>(null);
  const [certFileUrl, setCertFileUrl] = useState('');
  const [attachedUrl, setAttachedUrl] = useState<string | null>(null);
  const [isAttaching, setIsAttaching] = useState(false);
  const [attachFeedback, setAttachFeedback] = useState<{ error?: string; success?: string } | null>(null);

  async function handleAttachFile() {
    if (!created?.certificateId || !workflow.attachCertificateFile) return;
    const trimmed = certFileUrl.trim();
    if (!trimmed) {
      setAttachFeedback({ error: 'Vui lòng nhập đường dẫn file' });
      return;
    }
    if (!trimmed.startsWith('https://')) {
      setAttachFeedback({ error: 'Đường dẫn file phải dùng giao thức https://' });
      return;
    }
    try {
      setIsAttaching(true);
      setAttachFeedback(null);
      const updated = await workflow.attachCertificateFile(created.certificateId, trimmed);
      setAttachedUrl(updated.fileUrl ?? trimmed);
      setAttachFeedback({ success: 'Đã lưu đường dẫn file chứng nhận thành công!' });
      setCertFileUrl('');
    } catch (err) {
      setAttachFeedback({
        error: err instanceof Error ? err.message : 'Không thể lưu đường dẫn file chứng nhận',
      });
    } finally {
      setIsAttaching(false);
    }
  }

  function submit() {
    if (!selected) return;
    const input = {
      registrationId: selected.registration.id,
      screeningId: selected.screening.id,
      code,
      volumeMl: Number(volume),
      bloodGroup: selected.screening.bloodGroup,
      bloodType: toBackendBloodType(
        selected.screening.bloodGroup,
        selected.screening.rh,
      ),
    };
    const nextErrors = validateBloodBag(input);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    void mutation.run(
      () => workflow.createBloodBag(input),
      (bag) => {
        setCreated(bag);
        setAttachedUrl(bag.certificateFileUrl ?? null);
      },
      'Đã ghi nhận túi máu và cấp chứng nhận cho người hiến.',
    );
  }

  if (created)
    return (
      <WorkflowShell
        eyebrow="Quản lý túi máu"
        title="Đã ghi nhận túi máu"
        back="/clinic/blood-bags"
        backLabel="Danh sách túi máu"
      >
        <section className="workflow-card">
          <DetailList
            items={[
              { label: 'Mã túi máu', value: created.code },
              ...(created.certificateCode
                ? [{ label: 'Mã chứng nhận hiến máu', value: created.certificateCode }]
                : []),
              {
                label: 'Người hiến',
                value: created.donorName || selected?.registration.donorName || '—',
              },
              {
                label: 'Đợt hiến',
                value: created.campaignName || selected?.registration.campaignName || '—',
              },
              { label: 'Thể tích', value: `${created.volumeMl} ml` },
              { label: 'Nhóm máu', value: created.bloodGroup ?? selected?.screening.bloodGroup ?? '—' },
              {
                label: 'Trạng thái',
                value: BLOOD_BAG_STATUS_LABELS[created.status],
              },
            ]}
          />

          {created.certificateId && workflow.attachCertificateFile && (
            <div style={{ marginTop: '20px', padding: '16px', backgroundColor: 'var(--color-surface-sunken, #f9fafb)', borderRadius: '8px', border: '1px solid var(--color-border, #e5e7eb)' }}>
              <h3 style={{ margin: '0 0 6px 0', fontSize: '14px', fontWeight: 600 }}>Đính kèm file PDF chứng nhận</h3>
              <p className="workflow-muted" style={{ margin: '0 0 10px 0', fontSize: '12px' }}>
                Gắn liên kết file chứng nhận (bắt buộc https://) để lưu trữ và người hiến có thể tải về.
              </p>
              {attachedUrl && (
                <div style={{ marginBottom: '10px', padding: '8px 12px', backgroundColor: 'var(--color-brand-50, #fef2f4)', borderRadius: '6px', fontSize: '13px' }}>
                  ✓ Đã gắn file: <a href={attachedUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-brand-600, #a8192e)', textDecoration: 'underline' }}>Xem file PDF chứng nhận</a>
                </div>
              )}
              {attachFeedback?.error && (
                <div style={{ marginBottom: '10px', color: 'var(--color-danger, #dc2626)', fontSize: '13px' }}>
                  {attachFeedback.error}
                </div>
              )}
              {attachFeedback?.success && (
                <div style={{ marginBottom: '10px', color: 'var(--color-success, #16a34a)', fontSize: '13px' }}>
                  {attachFeedback.success}
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <Input
                  value={certFileUrl}
                  placeholder="https://example.com/certificates/CERT-xxx.pdf"
                  onChange={(e) => setCertFileUrl(e.target.value)}
                  style={{ flex: 1 }}
                />
                <Button
                  variant="secondary"
                  isLoading={isAttaching}
                  onClick={handleAttachFile}
                >
                  Gắn file
                </Button>
              </div>
            </div>
          )}

          <div className="workflow-actions" style={{ marginTop: '20px' }}>
            <Button variant="secondary" onClick={() => navigate('/clinic/blood-bags')}>
              Về danh sách túi máu
            </Button>
            <Button
              onClick={() => {
                setCreated(null);
                setSelected(null);
                setCode('');
                setVolume('350');
                setCertFileUrl('');
                setAttachedUrl(null);
                setAttachFeedback(null);
                eligible.retry();
              }}
            >
              Gắn túi khác
            </Button>
          </div>
        </section>
      </WorkflowShell>
    );

  return (
    <WorkflowShell
      eyebrow="Quản lý túi máu"
      title="Gắn mã túi máu"
      lead="Chỉ người hiến đã có kết luận sàng lọc đủ điều kiện mới được ghi nhận túi máu."
      back="/clinic/blood-bags"
      backLabel="Danh sách túi máu"
    >
      <MockNote />
      <section className="workflow-card" aria-labelledby="bag-eligible">
        <h2 id="bag-eligible">Người hiến đủ điều kiện</h2>
        <QueryState {...eligible} />
        {eligible.data && eligible.data.length === 0 && (
          <p className="workflow-empty">
            Chưa có người hiến nào đủ điều kiện. Hoàn tất sàng lọc trước.
          </p>
        )}
        <ul className="workflow-list">
          {eligible.data?.map((row) => (
            <li key={row.registration.id} className="workflow-list__item">
              <div>
                <h3>{row.registration.donorName}</h3>
                <p className="workflow-muted">
                  {row.registration.code} · {row.registration.campaignName}
                </p>
                <p className="workflow-muted">
                  Nhóm máu {row.screening.bloodGroup ?? '—'}
                  {row.screening.rh
                    ? ` · Rh ${row.screening.rh === 'POSITIVE' ? '+' : '−'}`
                    : ''}
                </p>
              </div>
              <div className="workflow-list__side">
                <StatusPill tone="success">Đủ điều kiện</StatusPill>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSelected(row);
                    setCreated(null);
                  }}
                >
                  Chọn người hiến
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {selected && (
        <section className="workflow-card" aria-labelledby="bag-form">
          <h2 id="bag-form">Thông tin túi máu</h2>
          <p className="workflow-muted">
            Người hiến: {selected.registration.donorName} ·{' '}
            {selected.registration.code}
          </p>
          <form
            className="workflow-form"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <FormField
              id="bag-code"
              label="Mã túi máu"
              error={errors.code}
              required
            >
              <Input
                value={code}
                placeholder="VD: BAG-00042"
                onChange={(event) => setCode(event.target.value)}
              />
            </FormField>
            <FormField
              id="bag-volume"
              label="Thể tích (ml)"
              error={errors.volumeMl}
              required
            >
              <Input
                type="number"
                min="1"
                inputMode="numeric"
                value={volume}
                onChange={(event) => setVolume(event.target.value)}
              />
            </FormField>
            <Feedback error={mutation.error} />
            <div className="workflow-actions">
              <Button type="submit" isLoading={mutation.pending}>
                Xác nhận
              </Button>
            </div>
          </form>
        </section>
      )}
    </WorkflowShell>
  );
}

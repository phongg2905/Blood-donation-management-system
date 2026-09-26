import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BLOOD_BAG_STATUSES, type BloodBagStatus } from '@blood/shared-types';
import { Button, FormField, Input } from '@/components/ui';
import { Feedback, QueryState } from '@/features/campaigns/components';
import {
  BLOOD_BAG_STATUS_LABELS,
  formatDateTime,
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

  function submit() {
    if (!selected) return;
    const input = {
      registrationId: selected.registration.id,
      code,
      volumeMl: Number(volume),
      bloodGroup: selected.screening.bloodGroup,
    };
    const nextErrors = validateBloodBag(input);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    void mutation.run(
      () => workflow.createBloodBag(input),
      (bag) => setCreated(bag),
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
              { label: 'Người hiến', value: created.donorName },
              { label: 'Đợt hiến', value: created.campaignName },
              { label: 'Thể tích', value: `${created.volumeMl} ml` },
              { label: 'Nhóm máu', value: created.bloodGroup ?? '—' },
              {
                label: 'Trạng thái',
                value: BLOOD_BAG_STATUS_LABELS[created.status],
              },
            ]}
          />
          <div className="workflow-actions">
            <Button variant="secondary" onClick={() => navigate('/clinic/blood-bags')}>
              Về danh sách túi máu
            </Button>
            <Button
              onClick={() => {
                setCreated(null);
                setSelected(null);
                setCode('');
                setVolume('350');
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

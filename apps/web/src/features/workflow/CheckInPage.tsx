import { useState } from 'react';
import { Button, FormField, Input } from '@/components/ui';
import { Feedback, QueryState } from '@/features/campaigns/components';
import {
  REGISTRATION_STATUS_LABELS,
  formatSlotRange,
} from './domain';
import { useWorkflowMutation, useWorkflowQuery } from './hooks';
import { useWorkflowRepository } from './repository';
import { DetailList, MockNote, StatusPill, WorkflowShell } from './components';
import type { CheckInQuery, DonorRegistration } from './types';

const statusTone = (registration: DonorRegistration) => {
  if (registration.checkedInAt) return 'success' as const;
  if (registration.status === 'CANCELLED') return 'danger' as const;
  return 'info' as const;
};

export function CheckInPage() {
  const workflow = useWorkflowRepository();
  const mutation = useWorkflowMutation();
  const [form, setForm] = useState<CheckInQuery>({
    code: '',
    identity: '',
    phone: '',
  });
  const [search, setSearch] = useState<CheckInQuery | null>(null);
  const [selected, setSelected] = useState<DonorRegistration | null>(null);

  const results = useWorkflowQuery(
    `checkin:${JSON.stringify(search)}`,
    () => workflow.findRegistrations(search ?? {}),
    search !== null,
  );

  const canCheckIn =
    selected !== null &&
    selected.checkedInAt === null &&
    (selected.status === 'SCHEDULED' || selected.status === 'CONFIRMED');

  function submitSearch() {
    setSelected(null);
    setSearch({ ...form });
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

  return (
    <WorkflowShell
      eyebrow="Quầy tiếp nhận"
      title="Check-in người hiến"
      lead="Tìm người hiến theo mã đăng ký, số CCCD hoặc số điện thoại, rồi xác nhận đã đến."
    >
      <MockNote />
      <section className="workflow-card" aria-labelledby="checkin-search">
        <h2 id="checkin-search">Tra cứu người hiến</h2>
        <form
          className="workflow-form workflow-form--inline"
          onSubmit={(event) => {
            event.preventDefault();
            submitSearch();
          }}
        >
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
              onChange={(event) =>
                setForm((prev) => ({ ...prev, identity: event.target.value }))
              }
            />
          </FormField>
          <FormField id="checkin-phone" label="Số điện thoại">
            <Input
              value={form.phone}
              inputMode="tel"
              onChange={(event) =>
                setForm((prev) => ({ ...prev, phone: event.target.value }))
              }
            />
          </FormField>
          <div className="workflow-form__action">
            <Button type="submit">Tìm kiếm</Button>
          </div>
        </form>
      </section>

      {search !== null && (
        <section className="workflow-card" aria-labelledby="checkin-results">
          <h2 id="checkin-results">Kết quả</h2>
          <QueryState {...results} />
          {results.data && results.data.length === 0 && (
            <p className="workflow-empty">
              Không tìm thấy đăng ký phù hợp. Kiểm tra lại mã, CCCD hoặc số điện
              thoại.
            </p>
          )}
          <ul className="workflow-list">
            {results.data?.map((registration) => (
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
                  <StatusPill tone={statusTone(registration)}>
                    {registration.checkedInAt
                      ? 'Đã check-in'
                      : REGISTRATION_STATUS_LABELS[registration.status]}
                  </StatusPill>
                  <Button
                    variant="secondary"
                    onClick={() => setSelected(registration)}
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
        <section className="workflow-card" aria-labelledby="checkin-detail">
          <h2 id="checkin-detail">Xác nhận check-in</h2>
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
                label: 'Trạng thái đăng ký',
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
          <Feedback error={mutation.error} success={mutation.success} />
          <div className="workflow-actions">
            <Button
              isLoading={mutation.pending}
              disabled={!canCheckIn}
              onClick={confirmCheckIn}
            >
              Xác nhận Check-in
            </Button>
          </div>
          {!canCheckIn && !selected.checkedInAt && (
            <p className="workflow-muted">
              Chỉ đăng ký đã xếp lịch hoặc đã xác nhận mới được check-in.
            </p>
          )}
        </section>
      )}
    </WorkflowShell>
  );
}

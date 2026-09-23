import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { Button, FormField, Input } from '@/components/ui';
import { useAuth } from '@/features/auth/hooks/useAuth';
import {
  CampaignShell,
  ConfirmDialog,
  Feedback,
  QueryState,
} from './components';
import {
  formatDate,
  timezoneLabel,
  toIso,
  toLocalInput,
  validateSlot,
  type FieldErrors,
} from './domain';
import {
  useCampaignMutation,
  useCampaignQuery,
  useUnsavedWarning,
} from './hooks';
import { useCampaignRepository } from './repository';
import type { Campaign, SlotInput, TimeSlot } from './types';

export function TimeSlotPage() {
  const { campaignId = '' } = useParams();
  const repository = useCampaignRepository();
  const result = useCampaignQuery(`slot-campaign:${campaignId}`, () =>
    repository.detail(campaignId),
  );
  return (
    <CampaignShell title="Quản lý khung giờ" back={`/campaigns/${campaignId}`}>
      <QueryState {...result} />
      {result.data && (
        <section className="panel">
          <h2>{result.data.name}</h2>
          <p>
            {formatDate(result.data.startsAt)} –{' '}
            {formatDate(result.data.endsAt)}
          </p>
          <TimeSlotList key={campaignId} campaign={result.data} manage />
        </section>
      )}
    </CampaignShell>
  );
}
export function TimeSlotList({
  campaign,
  manage = false,
}: {
  campaign: Campaign;
  manage?: boolean;
}) {
  const repository = useCampaignRepository();
  const { hasPermission } = useAuth();
  const result = useCampaignQuery(`slots:${campaign.id}`, () =>
    repository.slots(campaign.id),
  );
  const [editor, setEditor] = useState<TimeSlot | 'new' | null>(null);
  const [deactivate, setDeactivate] = useState<TimeSlot | null>(null);
  const [notice, setNotice] = useState('');
  const mutation = useCampaignMutation();
  return (
    <>
      <Feedback
        success={notice || mutation.success}
        error={!deactivate ? mutation.error : null}
      />
      <p className="campaign-muted">
        Thời gian theo {timezoneLabel}. Số chỗ là sức chứa của khung giờ, không
        phải số chỗ còn lại.
      </p>
      {manage && hasPermission('timeslot.create') && !editor && (
        <Button onClick={() => setEditor('new')}>Thêm khung giờ</Button>
      )}
      {editor && (
        <SlotForm
          key={typeof editor === 'string' ? editor : editor.id}
          campaign={campaign}
          slot={editor === 'new' ? undefined : editor}
          onCancel={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            setNotice('Đã lưu khung giờ.');
            result.retry();
          }}
        />
      )}
      <QueryState {...result} />
      {result.data &&
        (result.data.length ? (
          <ul className="campaign-slot-list">
            {result.data.map((slot) => (
              <li key={slot.id}>
                <div>
                  <h3>{slot.label || 'Khung giờ hiến máu'}</h3>
                  <p>
                    {formatDate(slot.startsAt)} – {formatDate(slot.endsAt)}
                  </p>
                  <span>
                    {slot.capacity.toLocaleString('vi-VN')} chỗ ·{' '}
                    {slot.isActive ? 'Đang hoạt động' : 'Đã ngừng hoạt động'}
                  </span>
                </div>
                {manage && (
                  <div className="campaign-actions">
                    {hasPermission('timeslot.update') && (
                      <Button
                        variant="secondary"
                        disabled={editor !== null}
                        onClick={() => setEditor(slot)}
                      >
                        Sửa khung giờ
                      </Button>
                    )}
                    {hasPermission('timeslot.deactivate') && slot.isActive && (
                      <Button
                        variant="ghost"
                        disabled={editor !== null}
                        onClick={() => setDeactivate(slot)}
                      >
                        Ngừng hoạt động
                      </Button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div className="campaign-empty">
            <h3>Chưa có khung giờ.</h3>
            <p>Khung giờ sẽ hiển thị tại đây khi được bổ sung.</p>
          </div>
        ))}
      {deactivate && (
        <ConfirmDialog
          title="Ngừng hoạt động khung giờ?"
          pending={mutation.pending}
          error={mutation.error}
          onCancel={() => setDeactivate(null)}
          onConfirm={() => {
            void mutation.run(
              () => repository.deactivateSlot(deactivate.id),
              () => {
                setDeactivate(null);
                result.retry();
              },
              'Đã ngừng hoạt động khung giờ.',
            );
          }}
        >
          <p>
            {formatDate(deactivate.startsAt)} – {formatDate(deactivate.endsAt)}
          </p>
          <p>Khung giờ này sẽ không nhận đăng ký hoặc chuyển lịch mới.</p>
        </ConfirmDialog>
      )}
    </>
  );
}
function SlotForm({
  campaign,
  slot,
  onCancel,
  onSaved,
}: {
  campaign: Campaign;
  slot?: TimeSlot | undefined;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const repository = useCampaignRepository();
  const mutation = useCampaignMutation();
  const [initial] = useState({
    startsAt: toLocalInput(slot?.startsAt ?? campaign.startsAt),
    endsAt: toLocalInput(slot?.endsAt ?? campaign.endsAt),
    capacity: String(slot?.capacity ?? ''),
    label: slot?.label ?? '',
  });
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [cancel, setCancel] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const dirty = JSON.stringify(values) !== JSON.stringify(initial);
  useUnsavedWarning(dirty && !mutation.success);
  useEffect(() => {
    form.current
      ?.querySelector<HTMLInputElement>('[aria-invalid="true"]')
      ?.focus();
  }, [errors, mutation.error]);
  function submit(event: FormEvent) {
    event.preventDefault();
    const input: SlotInput = {
      startsAt: toIso(values.startsAt) ?? '',
      endsAt: toIso(values.endsAt) ?? '',
      capacity: Number(values.capacity),
      label: values.label.trim() || null,
    };
    const next = validateSlot(input, campaign);
    setErrors(next);
    if (Object.keys(next).length) return;
    void mutation.run(
      () =>
        slot
          ? repository.updateSlot(slot.id, input)
          : repository.createSlot(campaign.id, input),
      onSaved,
    );
  }
  return (
    <>
      <form
        className="campaign-form campaign-slot-form"
        ref={form}
        noValidate
        onSubmit={submit}
      >
        <h3>{slot ? 'Chỉnh sửa khung giờ' : 'Thêm khung giờ'}</h3>
        <Feedback error={mutation.error} />
        <fieldset disabled={mutation.pending}>
          <div className="campaign-form-grid">
            {(
              [
                { name: 'label', label: 'Tên khung giờ', type: 'text' },
                { name: 'startsAt', label: 'Bắt đầu', type: 'datetime-local' },
                { name: 'endsAt', label: 'Kết thúc', type: 'datetime-local' },
                { name: 'capacity', label: 'Số chỗ', type: 'number' },
              ] as const
            ).map((field) => (
              <FormField
                key={field.name}
                id={`slot-${field.name}`}
                label={field.label}
                required={field.name !== 'label'}
                error={errors[field.name] ?? mutation.error?.fields[field.name]}
              >
                <Input
                  type={field.type}
                  min={field.type === 'number' ? 1 : undefined}
                  step={field.type === 'number' ? 1 : undefined}
                  value={values[field.name]}
                  onChange={(event) =>
                    setValues({ ...values, [field.name]: event.target.value })
                  }
                />
              </FormField>
            ))}
          </div>
        </fieldset>
        <div className="campaign-actions">
          <Button type="submit" isLoading={mutation.pending}>
            Lưu khung giờ
          </Button>
          <Button
            variant="secondary"
            disabled={mutation.pending}
            onClick={() => (dirty ? setCancel(true) : onCancel())}
          >
            Hủy
          </Button>
        </div>
      </form>
      {cancel && (
        <ConfirmDialog
          title="Bỏ thay đổi khung giờ?"
          pending={false}
          onCancel={() => setCancel(false)}
          onConfirm={onCancel}
          label="Bỏ thay đổi"
        >
          <p>Thông tin vừa nhập sẽ không được lưu.</p>
        </ConfirmDialog>
      )}
    </>
  );
}

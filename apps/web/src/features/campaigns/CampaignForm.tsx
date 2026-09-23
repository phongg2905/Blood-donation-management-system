import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, FormField, Input } from '@/components/ui';
import { useCampaignRepository } from './repository';
import { useCampaignMutation, useUnsavedWarning } from './hooks';
import { ConfirmDialog, Feedback } from './components';
import {
  timezoneLabel,
  toIso,
  toLocalInput,
  validateCampaign,
  type FieldErrors,
} from './domain';
import type { Campaign, CampaignInput } from './types';

const fields = [
  { name: 'name', label: 'Tên đợt hiến máu', required: true, max: 200 },
  { name: 'location', label: 'Địa điểm', required: true, max: 500 },
  { name: 'organizerName', label: 'Đơn vị tổ chức' },
  { name: 'contactPhone', label: 'Điện thoại liên hệ', type: 'tel' },
  {
    name: 'startsAt',
    label: 'Bắt đầu đợt hiến',
    type: 'datetime-local',
    required: true,
  },
  {
    name: 'endsAt',
    label: 'Kết thúc đợt hiến',
    type: 'datetime-local',
    required: true,
  },
  { name: 'registrationOpensAt', label: 'Mở đăng ký', type: 'datetime-local' },
  {
    name: 'registrationClosesAt',
    label: 'Đóng đăng ký',
    type: 'datetime-local',
  },
  { name: 'targetDonors', label: 'Chỉ tiêu người hiến', type: 'number' },
  {
    name: 'targetBloodVolumeMl',
    label: 'Chỉ tiêu thể tích máu (ml)',
    type: 'number',
  },
] as const;
type Values = Record<keyof CampaignInput, string>;
function initialValues(campaign?: Campaign): Values {
  const result = { description: campaign?.description ?? '' } as Values;
  for (const field of fields)
    result[field.name] = field.name.endsWith('At')
      ? toLocalInput((campaign?.[field.name] as string | null) ?? null)
      : String(campaign?.[field.name] ?? '');
  return result;
}
export function CampaignForm({ campaign }: { campaign?: Campaign }) {
  const repository = useCampaignRepository();
  const mutation = useCampaignMutation();
  const navigate = useNavigate();
  const [initial] = useState(() => initialValues(campaign));
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [confirmCancel, setConfirmCancel] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const dirty = JSON.stringify(values) !== JSON.stringify(initial);
  useUnsavedWarning(dirty && !mutation.success);
  const cancel = () =>
    navigate(campaign ? `/campaigns/${campaign.id}` : '/campaigns');
  useEffect(() => {
    form.current
      ?.querySelector<HTMLInputElement>('[aria-invalid="true"]')
      ?.focus();
  }, [errors, mutation.error]);
  function submit(event: FormEvent) {
    event.preventDefault();
    const payload = Object.fromEntries(
      Object.entries(values).map(([key, value]) => [
        key,
        key.endsWith('At')
          ? toIso(value)
          : key.startsWith('target')
            ? value === ''
              ? null
              : Number(value)
            : value.trim() || null,
      ]),
    ) as unknown as CampaignInput;
    payload.name = values.name.trim();
    payload.location = values.location.trim();
    const next = validateCampaign(payload);
    setErrors(next);
    if (Object.keys(next).length) return;
    void mutation.run(
      () =>
        campaign
          ? repository.update(campaign.id, payload)
          : repository.create(payload),
      (result) =>
        navigate(`/campaigns/${result.id}`, {
          replace: true,
          state: {
            campaignNotice: campaign
              ? 'Đã lưu đợt hiến máu.'
              : 'Đã tạo bản nháp đợt hiến máu.',
          },
        }),
    );
  }
  return (
    <>
      <form
        ref={form}
        className="campaign-form panel"
        noValidate
        onSubmit={submit}
        aria-busy={mutation.pending}
      >
        <Feedback error={mutation.error} />
        <p>Các mục có dấu * là bắt buộc. Thời gian theo {timezoneLabel}.</p>
        <fieldset disabled={mutation.pending}>
          <div className="campaign-form-grid">
            {fields.map((field) => (
              <FormField
                key={field.name}
                id={`campaign-${field.name}`}
                label={field.label}
                required={'required' in field && field.required}
                error={errors[field.name] ?? mutation.error?.fields[field.name]}
              >
                <Input
                  name={field.name}
                  type={'type' in field ? field.type : 'text'}
                  maxLength={'max' in field ? field.max : undefined}
                  min={
                    'type' in field && field.type === 'number' ? 1 : undefined
                  }
                  step={
                    'type' in field && field.type === 'number' ? 1 : undefined
                  }
                  value={values[field.name]}
                  onChange={(event) =>
                    setValues({ ...values, [field.name]: event.target.value })
                  }
                />
              </FormField>
            ))}
          </div>
          <FormField
            id="campaign-description"
            label="Mô tả"
            error={mutation.error?.fields.description}
          >
            <textarea
              className="input"
              rows={5}
              value={values.description}
              onChange={(event) =>
                setValues({ ...values, description: event.target.value })
              }
            />
          </FormField>
        </fieldset>
        <div className="campaign-actions">
          <Button type="submit" isLoading={mutation.pending}>
            {campaign ? 'Lưu thay đổi' : 'Tạo bản nháp'}
          </Button>
          <Button
            variant="secondary"
            disabled={mutation.pending}
            onClick={() => (dirty ? setConfirmCancel(true) : cancel())}
          >
            Hủy
          </Button>
        </div>
      </form>
      {confirmCancel && (
        <ConfirmDialog
          title="Bỏ thay đổi chưa lưu?"
          pending={false}
          onCancel={() => setConfirmCancel(false)}
          onConfirm={cancel}
          label="Bỏ thay đổi"
        >
          <p>Thông tin vừa nhập sẽ không được lưu.</p>
        </ConfirmDialog>
      )}
    </>
  );
}

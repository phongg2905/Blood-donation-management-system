import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button, Checkbox } from '@/components/ui';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useCampaignRepository } from '@/features/campaigns/repository';
import { Feedback, QueryState } from '@/features/campaigns/components';
import { STATUS_LABELS } from '@/features/campaigns/domain';
import type { Campaign, TimeSlot } from '@/features/campaigns/types';
import {
  HEALTH_QUESTIONS,
  REGISTRATION_STATUS_LABELS,
  formatDate,
  formatSlotRange,
  validateHealthDeclaration,
  type FieldErrors,
} from './domain';
import { useWorkflowMutation, useWorkflowQuery } from './hooks';
import { useWorkflowRepository } from './repository';
import {
  DetailList,
  MockNote,
  QrPlaceholder,
  Stepper,
  type StepDefinition,
} from './components';
import type { DonorRegistration } from './types';

const STEPS: readonly StepDefinition[] = [
  { id: 'campaign', label: 'Chọn đợt hiến' },
  { id: 'slot', label: 'Chọn khung giờ' },
  { id: 'health', label: 'Khai báo sức khỏe' },
  { id: 'review', label: 'Xem lại' },
  { id: 'done', label: 'Hoàn tất' },
];

export function DonorRegistrationPage() {
  const campaignRepository = useCampaignRepository();
  const workflow = useWorkflowRepository();
  const { currentUser } = useAuth();
  const mutation = useWorkflowMutation();

  const [step, setStep] = useState(0);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [slot, setSlot] = useState<TimeSlot | null>(null);
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [confirmed, setConfirmed] = useState(false);
  const [healthErrors, setHealthErrors] = useState<FieldErrors>({});
  const [created, setCreated] = useState<DonorRegistration | null>(null);
  const [params, setParams] = useSearchParams();
  const preselectId = params.get('campaign');
  const preselectApplied = useRef(false);
  const [preselectMissing, setPreselectMissing] = useState(false);

  const campaigns = useWorkflowQuery('open-campaigns', () =>
    campaignRepository.list({ status: 'OPEN', page: 1, limit: 50 }),
  );
  const slotData = useWorkflowQuery(
    `slots:${campaign?.id ?? ''}`,
    async () => {
      if (!campaign)
        return {
          slots: [] as TimeSlot[],
          counts: {} as Record<string, number>,
        };
      const slots = await campaignRepository.slots(campaign.id);
      const counts = await workflow.availability(slots.map((item) => item.id));
      return { slots, counts };
    },
    Boolean(campaign),
  );

  // A donor reaches this screen from a campaign card
  // (`/donor/register?campaign=<id>`). Apply that choice once when the open
  // campaigns arrive, then hand control to the wizard so the preselect never
  // fights the user's own selection.
  useEffect(() => {
    if (preselectApplied.current || !preselectId || !campaigns.data) return;
    preselectApplied.current = true;
    const match = campaigns.data.items.find((item) => item.id === preselectId);
    if (match) {
      setCampaign(match);
      setSlot(null);
      setStep(1);
    } else {
      setPreselectMissing(true);
    }
  }, [campaigns.data, preselectId]);

  const donorId = currentUser?.id ?? '';
  const donorName = currentUser?.fullName ?? '';

  /** Drops `?campaign=` so the URL stops advertising a choice already applied. */
  function clearPreselect() {
    if (!params.has('campaign')) return;
    const next = new URLSearchParams(params);
    next.delete('campaign');
    setParams(next, { replace: true });
  }

  function selectCampaign(next: Campaign) {
    setCampaign(next);
    setSlot(null);
    setPreselectMissing(false);
    setStep(1);
    clearPreselect();
  }

  function submitHealth() {
    const errors = validateHealthDeclaration(answers, confirmed);
    setHealthErrors(errors);
    if (Object.keys(errors).length === 0) setStep(3);
  }

  function confirm() {
    if (!campaign || !slot) return;
    void mutation.run(
      () =>
        workflow.register({
          donorId,
          donorName,
          donorPhone: currentUser?.phone ?? null,
          campaign: {
            id: campaign.id,
            name: campaign.name,
            location: campaign.location,
            startsAt: campaign.startsAt,
            endsAt: campaign.endsAt,
          },
          slot: { id: slot.id, startsAt: slot.startsAt, endsAt: slot.endsAt },
          health: { answers, confirmed },
        }),
      (registration) => {
        setCreated(registration);
        setStep(4);
      },
      'Đăng ký hiến máu thành công.',
    );
  }

  return (
    <div className="workflow-page">
      <header className="workflow-heading">
        <p className="workflow-eyebrow">Đăng ký hiến máu</p>
        <h1>Đặt lịch hiến máu của bạn</h1>
        <p className="workflow-lead">
          Chọn đợt hiến, khung giờ và khai báo sức khỏe. Bạn sẽ nhận mã đăng ký
          để dùng tại quầy tiếp nhận.
        </p>
      </header>
      <MockNote />
      <Stepper steps={STEPS} current={step} />

      {step === 0 && (
        <section className="workflow-card" aria-labelledby="step-campaign">
          <h2 id="step-campaign">Bước 1 · Chọn đợt hiến máu</h2>
          <QueryState {...campaigns} />
          {preselectMissing && (
            <p className="workflow-empty" role="status">
              Đợt hiến máu bạn chọn hiện không mở đăng ký. Hãy chọn một đợt khác
              bên dưới.
            </p>
          )}
          {campaigns.data && campaigns.data.items.length === 0 && (
            <p className="workflow-empty">
              Hiện chưa có đợt hiến máu nào đang mở đăng ký.
            </p>
          )}
          <ul className="workflow-list">
            {campaigns.data?.items.map((item) => (
              <li key={item.id} className="workflow-list__item">
                <div>
                  <h3>{item.name}</h3>
                  <p className="workflow-muted">{item.location}</p>
                  <p className="workflow-muted">
                    {formatDate(item.startsAt)} → {formatDate(item.endsAt)}
                  </p>
                </div>
                <div className="workflow-list__side">
                  <span className="pill pill--success">
                    {STATUS_LABELS[item.status]}
                  </span>
                  <Button onClick={() => selectCampaign(item)}>
                    Chọn đợt này
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {step === 1 && campaign && (
        <section className="workflow-card" aria-labelledby="step-slot">
          <h2 id="step-slot">Bước 2 · Chọn khung giờ</h2>
          <p className="workflow-muted">
            {campaign.name} · {campaign.location}
          </p>
          <QueryState {...slotData} />
          {slotData.data && slotData.data.slots.length === 0 && (
            <p className="workflow-empty">
              Đợt hiến này chưa có khung giờ khả dụng.
            </p>
          )}
          <ul className="workflow-list">
            {slotData.data?.slots
              .filter((item) => item.isActive)
              .map((item) => {
                const registered = slotData.data?.counts[item.id] ?? 0;
                const remaining = Math.max(item.capacity - registered, 0);
                const full = remaining === 0;
                return (
                  <li key={item.id} className="workflow-list__item">
                    <div>
                      <h3>{formatSlotRange(item.startsAt, item.endsAt)}</h3>
                      <p className="workflow-muted">
                        Sức chứa {item.capacity} · đã đăng ký {registered} · còn{' '}
                        {remaining}
                      </p>
                    </div>
                    <div className="workflow-list__side">
                      <span
                        className={`pill pill--${full ? 'danger' : 'info'}`}
                      >
                        {full ? 'Hết chỗ' : 'Còn chỗ'}
                      </span>
                      <Button
                        disabled={full}
                        onClick={() => {
                          setSlot(item);
                          setStep(2);
                        }}
                      >
                        {full ? 'Hết chỗ' : 'Chọn khung giờ'}
                      </Button>
                    </div>
                  </li>
                );
              })}
          </ul>
          <div className="workflow-actions">
            <Button
              variant="secondary"
              onClick={() => {
                setStep(0);
                setCampaign(null);
                setSlot(null);
                clearPreselect();
              }}
            >
              Đổi đợt hiến
            </Button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="workflow-card" aria-labelledby="step-health">
          <h2 id="step-health">Bước 3 · Khai báo sức khỏe</h2>
          <p className="workflow-muted">
            Vui lòng trả lời trung thực. Thông tin này được nhân viên y tế dùng
            khi sàng lọc.
          </p>
          <div className="workflow-questions">
            {HEALTH_QUESTIONS.map((question) => (
              <fieldset key={question.code} className="workflow-question">
                <legend>{question.label}</legend>
                <div className="workflow-choice">
                  <label>
                    <input
                      type="radio"
                      name={question.code}
                      checked={answers[question.code] === false}
                      onChange={() =>
                        setAnswers((prev) => ({
                          ...prev,
                          [question.code]: false,
                        }))
                      }
                    />
                    Không
                  </label>
                  <label>
                    <input
                      type="radio"
                      name={question.code}
                      checked={answers[question.code] === true}
                      onChange={() =>
                        setAnswers((prev) => ({
                          ...prev,
                          [question.code]: true,
                        }))
                      }
                    />
                    Có
                  </label>
                </div>
                {healthErrors[question.code] && (
                  <p className="field__error">{healthErrors[question.code]}</p>
                )}
              </fieldset>
            ))}
          </div>
          <Checkbox
            id="health-confirm"
            checked={confirmed}
            error={healthErrors.confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
          >
            Tôi xác nhận các thông tin khai báo trên là đúng sự thật.
          </Checkbox>
          <div className="workflow-actions">
            <Button variant="secondary" onClick={() => setStep(1)}>
              Quay lại
            </Button>
            <Button onClick={submitHealth}>Tiếp tục</Button>
          </div>
        </section>
      )}

      {step === 3 && campaign && slot && (
        <section className="workflow-card" aria-labelledby="step-review">
          <h2 id="step-review">Bước 4 · Xem lại thông tin</h2>
          <DetailList
            items={[
              { label: 'Đợt hiến', value: campaign.name },
              { label: 'Địa điểm', value: campaign.location },
              { label: 'Ngày', value: formatDate(campaign.startsAt) },
              {
                label: 'Khung giờ',
                value: formatSlotRange(slot.startsAt, slot.endsAt),
              },
              { label: 'Người hiến', value: donorName },
              {
                label: 'Điện thoại',
                value: currentUser?.phone ?? 'Chưa cập nhật',
              },
            ]}
          />
          <h3>Khai báo sức khỏe</h3>
          <ul className="workflow-answers">
            {HEALTH_QUESTIONS.map((question) => (
              <li key={question.code}>
                <span>{question.label}</span>
                <strong>{answers[question.code] ? 'Có' : 'Không'}</strong>
              </li>
            ))}
          </ul>
          <Feedback error={mutation.error} />
          <div className="workflow-actions">
            <Button variant="secondary" onClick={() => setStep(2)}>
              Quay lại sửa
            </Button>
            <Button isLoading={mutation.pending} onClick={confirm}>
              Xác nhận đăng ký
            </Button>
          </div>
        </section>
      )}

      {step === 4 && created && (
        <section className="workflow-card" aria-labelledby="step-done">
          <h2 id="step-done">Bước 5 · Đăng ký thành công</h2>
          <div className="workflow-confirmation">
            <div>
              <p className="workflow-muted">Mã đăng ký của bạn</p>
              <p className="workflow-code">{created.code}</p>
              <DetailList
                items={[
                  { label: 'Đợt hiến', value: created.campaignName },
                  { label: 'Địa điểm', value: created.location },
                  {
                    label: 'Khung giờ',
                    value: formatSlotRange(
                      created.slotStartsAt,
                      created.slotEndsAt,
                    ),
                  },
                  {
                    label: 'Trạng thái',
                    value: REGISTRATION_STATUS_LABELS[created.status],
                  },
                ]}
              />
            </div>
            <QrPlaceholder code={created.code} />
          </div>
          <div className="workflow-actions">
            <Link className="btn btn--secondary" to="/donor/history">
              Xem lịch sử hiến máu
            </Link>
            <Button
              onClick={() => {
                setStep(0);
                setCampaign(null);
                setSlot(null);
                setAnswers({});
                setConfirmed(false);
                setCreated(null);
              }}
            >
              Đăng ký đợt khác
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}

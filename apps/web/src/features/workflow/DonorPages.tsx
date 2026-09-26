import { Link, useParams } from 'react-router-dom';
import { Button } from '@/components/ui';
import { QueryState } from '@/features/campaigns/components';
import { useAuth } from '@/features/auth/hooks/useAuth';
import {
  CERTIFICATE_STATUS_LABELS,
  REGISTRATION_STATUS_LABELS,
  formatDate,
  formatDateTime,
  formatSlotRange,
} from './domain';
import { useWorkflowQuery } from './hooks';
import { useWorkflowRepository } from './repository';
import {
  DetailList,
  MockNote,
  QrPlaceholder,
  StatusPill,
  WorkflowShell,
} from './components';

const TERMINAL: readonly string[] = ['COMPLETED', 'CANCELLED', 'NO_SHOW'];

export function DonorHistoryPage() {
  const workflow = useWorkflowRepository();
  const { currentUser } = useAuth();
  const donorId = currentUser?.id ?? '';

  const registrations = useWorkflowQuery(
    'my-registrations',
    () => workflow.myRegistrations(donorId),
    Boolean(donorId),
  );
  const history = useWorkflowQuery(
    'donor-history',
    () => workflow.history(donorId),
    Boolean(donorId),
  );

  const upcoming = (registrations.data ?? []).filter(
    (item) => !TERMINAL.includes(item.status),
  );

  return (
    <WorkflowShell
      eyebrow="Người hiến máu"
      title="Lịch sử hiến máu của bạn"
      lead="Theo dõi các lần hiến máu đã hoàn tất và các đăng ký sắp tới."
      actions={
        <Link className="btn btn--primary" to="/donor/register">
          Đăng ký hiến máu
        </Link>
      }
    >
      <MockNote />

      <section className="workflow-card" aria-labelledby="history-upcoming">
        <h2 id="history-upcoming">Đăng ký sắp tới</h2>
        <QueryState {...registrations} />
        {registrations.data && upcoming.length === 0 && (
          <p className="workflow-empty">
            Bạn chưa có đăng ký nào sắp tới. Hãy chọn một đợt hiến máu.
          </p>
        )}
        <ul className="workflow-list">
          {upcoming.map((item) => (
            <li key={item.id} className="workflow-list__item">
              <div>
                <h3>{item.campaignName}</h3>
                <p className="workflow-muted">{item.location}</p>
                <p className="workflow-muted">
                  {formatSlotRange(item.slotStartsAt, item.slotEndsAt)}
                </p>
                <p className="workflow-muted">Mã đăng ký: {item.code}</p>
              </div>
              <div className="workflow-list__side">
                <StatusPill tone="info">
                  {REGISTRATION_STATUS_LABELS[item.status]}
                </StatusPill>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="workflow-card" aria-labelledby="history-past">
        <h2 id="history-past">Các lần hiến máu</h2>
        <QueryState {...history} />
        {history.data && history.data.length === 0 && (
          <p className="workflow-empty">Chưa có lần hiến máu nào được ghi nhận.</p>
        )}
        <ul className="workflow-list">
          {history.data?.map((entry) => (
            <li key={entry.id} className="workflow-list__item">
              <div>
                <h3>{entry.campaignName}</h3>
                <p className="workflow-muted">{entry.location}</p>
                <p className="workflow-muted">
                  {formatDate(entry.date)} · {entry.volumeMl ?? '—'} ml · nhóm máu{' '}
                  {entry.bloodGroup ?? '—'}
                </p>
              </div>
              <div className="workflow-list__side">
                <StatusPill tone="success">
                  {REGISTRATION_STATUS_LABELS[entry.status]}
                </StatusPill>
                {entry.certificateId ? (
                  <Link
                    className="btn btn--secondary"
                    to={`/donor/certificates/${entry.certificateId}`}
                  >
                    Xem chứng nhận
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </WorkflowShell>
  );
}

export function CertificatesPage() {
  const workflow = useWorkflowRepository();
  const { currentUser } = useAuth();
  const donorId = currentUser?.id ?? '';
  const certificates = useWorkflowQuery(
    'donor-certificates',
    () => workflow.certificates(donorId),
    Boolean(donorId),
  );

  return (
    <WorkflowShell
      eyebrow="Người hiến máu"
      title="Chứng nhận hiến máu"
      lead="Chứng nhận minh họa cho các lần hiến máu đã ghi nhận."
      back="/donor/history"
      backLabel="Lịch sử hiến máu"
    >
      <MockNote>
        Đây là chứng nhận minh họa cho mục đích phát triển, không phải chứng
        nhận chính thức và không có chữ ký số.
      </MockNote>
      <QueryState {...certificates} />
      {certificates.data && certificates.data.length === 0 && (
        <p className="workflow-empty">Bạn chưa có chứng nhận nào.</p>
      )}
      <ul className="workflow-list">
        {certificates.data?.map((certificate) => (
          <li key={certificate.id} className="workflow-list__item">
            <div>
              <h3>{certificate.code}</h3>
              <p className="workflow-muted">
                {certificate.campaignName} · {formatDate(certificate.donationDate)}
              </p>
              <p className="workflow-muted">
                {certificate.volumeMl} ml · nhóm máu {certificate.bloodGroup ?? '—'}
              </p>
            </div>
            <div className="workflow-list__side">
              <StatusPill
                tone={certificate.status === 'ACTIVE' ? 'success' : 'danger'}
              >
                {CERTIFICATE_STATUS_LABELS[certificate.status]}
              </StatusPill>
              <Link
                className="btn btn--secondary"
                to={`/donor/certificates/${certificate.id}`}
              >
                Xem chi tiết
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </WorkflowShell>
  );
}

export function CertificateDetailPage() {
  const { certificateId = '' } = useParams();
  const workflow = useWorkflowRepository();
  const certificate = useWorkflowQuery(
    `certificate:${certificateId}`,
    () => workflow.certificate(certificateId),
    Boolean(certificateId),
  );

  return (
    <WorkflowShell
      eyebrow="Người hiến máu"
      title="Chứng nhận hiến máu"
      back="/donor/certificates"
      backLabel="Danh sách chứng nhận"
    >
      <MockNote>
        Chứng nhận minh họa, không phải chứng nhận chính thức.
      </MockNote>
      <QueryState {...certificate} />
      {certificate.data && (
        <div className="workflow-certificate">
          <div>
            <p className="workflow-eyebrow">Chứng nhận hiến máu tình nguyện</p>
            <h2>{certificate.data.donorName}</h2>
            <p className="workflow-lead">
              đã hiến {certificate.data.volumeMl} ml máu tại{' '}
              {certificate.data.location}.
            </p>
            <DetailList
              items={[
                { label: 'Mã chứng nhận', value: certificate.data.code },
                {
                  label: 'Ngày hiến',
                  value: formatDate(certificate.data.donationDate),
                },
                { label: 'Đợt hiến', value: certificate.data.campaignName },
                { label: 'Nhóm máu', value: certificate.data.bloodGroup ?? '—' },
                {
                  label: 'Trạng thái',
                  value: CERTIFICATE_STATUS_LABELS[certificate.data.status],
                },
                {
                  label: 'Cấp ngày',
                  value: formatDateTime(certificate.data.issuedAt),
                },
              ]}
            />
          </div>
          <QrPlaceholder code={certificate.data.code} />
        </div>
      )}
      {certificate.data && (
        <div className="workflow-actions">
          <Button variant="secondary" onClick={() => window.print()}>
            In chứng nhận
          </Button>
        </div>
      )}
    </WorkflowShell>
  );
}

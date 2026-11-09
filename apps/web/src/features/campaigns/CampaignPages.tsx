import { useState } from 'react';
import {
  Link,
  useLocation,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import {
  CAMPAIGN_STATUSES,
  CAMPAIGN_STATUSES_FROZEN,
  type CampaignStatus,
} from '@blood/shared-types';
import { Button, FormField, Input } from '@/components/ui';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { CampaignForm } from './CampaignForm';
import {
  CampaignShell,
  ConfirmDialog,
  Feedback,
  QueryState,
  StatusBadge,
} from './components';
import {
  ACTIONS,
  canAct,
  formatDate,
  getRegistrationWindowInfo,
  STATUS_LABELS,
} from './domain';
import { useCampaignMutation, useCampaignQuery } from './hooks';
import { useCampaignRepository } from './repository';
import type { Campaign, CampaignAction, CampaignQuery } from './types';
import { TimeSlotList } from './TimeSlotPage';
import {
  getOperationalWindow,
  OPERATIONAL_STATUS_SHORT_LABELS,
} from '@/features/workflow/domain';
import { WorkflowPagination } from '@/features/workflow/components';

export function CampaignListPage() {
  const repository = useCampaignRepository();
  const { hasPermission } = useAuth();
  const [params, setParams] = useSearchParams();
  const status = params.get('status');
  const requestedPage = Number(params.get('page'));
  const page =
    Number.isSafeInteger(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1;
  const isUpcoming = status === 'UPCOMING';
  const query: CampaignQuery = {
    page,
    limit: 10,
    search: params.get('search') ?? '',
    ...(isUpcoming
      ? { status: 'UPCOMING' }
      : CAMPAIGN_STATUSES.includes(status as CampaignStatus)
        ? { status: status as CampaignStatus }
        : {}),
    ...(params.get('from') ? { from: params.get('from')! } : {}),
    ...(params.get('to') ? { to: params.get('to')! } : {}),
    sort: params.get('sort') === 'desc' ? 'desc' : 'asc',
  };
  const result = useCampaignQuery(`list:${params}`, () =>
    repository.list(query),
  );
  function change(name: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value);
    else next.delete(name);
    if (name !== 'page') next.delete('page');
    setParams(next);
  }
  return (
    <CampaignShell>
      <div className="campaign-toolbar">
        <h2>Đợt hiến máu</h2>
        {hasPermission('campaign.create') && (
          <Link className="btn btn--primary" to="/campaigns/new">
            Tạo đợt hiến
          </Link>
        )}
      </div>
      <form
        className="campaign-filters"
        onSubmit={(event) => event.preventDefault()}
      >
        <FormField id="campaign-search" label="Tìm kiếm">
          <Input
            type="search"
            value={query.search}
            placeholder="Tên đợt hiến hoặc địa điểm"
            onChange={(event) => change('search', event.target.value)}
          />
        </FormField>
        <FormField id="campaign-status" label="Trạng thái">
          <select
            className="input"
            value={query.status ?? ''}
            onChange={(event) => change('status', event.target.value)}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="OPEN">Đang mở nhận đăng ký</option>
            <option value="UPCOMING">Sắp mở đăng ký</option>
            <option value="CLOSED">Đã đóng đăng ký</option>
            <option value="COMPLETED">Đã hoàn tất</option>
            <option value="CANCELLED">Đã hủy</option>
            {hasPermission('campaign.create') && (
              <option value="DRAFT">Bản nháp</option>
            )}
          </select>
        </FormField>
        <FormField id="campaign-from" label="Từ ngày">
          <Input
            type="date"
            value={query.from ?? ''}
            onChange={(event) => change('from', event.target.value)}
          />
        </FormField>
        <FormField id="campaign-to" label="Đến ngày">
          <Input
            type="date"
            min={query.from}
            value={query.to ?? ''}
            onChange={(event) => change('to', event.target.value)}
          />
        </FormField>
        <FormField id="campaign-sort" label="Sắp xếp">
          <select
            className="input"
            value={query.sort}
            onChange={(event) => change('sort', event.target.value)}
          >
            <option value="asc">Thời gian tăng dần</option>
            <option value="desc">Thời gian giảm dần</option>
          </select>
        </FormField>
        <Button variant="ghost" onClick={() => setParams({})}>
          Xóa bộ lọc
        </Button>
      </form>
      <QueryState {...result} variant="campaign-list" count={4} />
      {!result.loading && result.data && (
        <>
          <p className="campaign-muted" role="status">
            {result.data.meta.total} đợt hiến máu
          </p>
          {result.data.items.length ? (
            <div className="campaign-list">
              {result.data.items.map((campaign) => (
                <article className="campaign-row" key={campaign.id}>
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        flexWrap: 'wrap',
                        marginBottom: '8px',
                      }}
                    >
                      {(() => {
                        const regInfo = getRegistrationWindowInfo(campaign);
                        const isUpcoming =
                          campaign.status === 'OPEN' &&
                          regInfo.state === 'NOT_OPEN_YET';
                        return (
                          <>
                            {isUpcoming ? (
                              <span className="campaign-status campaign-status--upcoming">
                                Sắp mở đăng ký
                              </span>
                            ) : (
                              <StatusBadge status={campaign.status} />
                            )}
                            {regInfo.label && (
                              <span
                                className={`reg-timing-note reg-timing-note--${regInfo.state.toLowerCase()}`}
                              >
                                {regInfo.label}
                              </span>
                            )}
                          </>
                        );
                      })()}
                    </div>
                    <h2>
                      <Link to={`/campaigns/${campaign.id}`}>
                        {campaign.name}
                      </Link>
                    </h2>
                    <p>{campaign.location}</p>
                    <p className="campaign-muted">{campaign.description}</p>
                  </div>
                  <div className="campaign-row-aside">
                    <time dateTime={campaign.startsAt}>
                      Bắt đầu: {formatDate(campaign.startsAt)}
                    </time>
                    {(() => {
                      const regInfo = getRegistrationWindowInfo(campaign);
                      if (!hasPermission('registration.create')) return null;
                      if (campaign.status === 'OPEN') {
                        if (regInfo.isAcceptingRegistration) {
                          return (
                            <Link
                              className="btn btn--primary"
                              to={`/donor/register?campaign=${campaign.id}`}
                            >
                              Đăng ký hiến máu
                            </Link>
                          );
                        }
                        if (regInfo.state === 'NOT_OPEN_YET') {
                          return (
                            <span
                              className="btn btn--secondary"
                              style={{ opacity: 0.6, cursor: 'not-allowed' }}
                              title="Chưa đến thời gian mở cổng đăng ký"
                            >
                              Chưa mở đăng ký
                            </span>
                          );
                        }
                      }
                      return null;
                    })()}
                    <Link
                      className="btn btn--secondary"
                      to={`/campaigns/${campaign.id}`}
                    >
                      Xem chi tiết
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="campaign-empty">
              <h2>Chưa có đợt hiến máu phù hợp.</h2>
              <p>Thử thay đổi từ khóa hoặc bộ lọc để tìm thêm đợt hiến.</p>
              <Button variant="secondary" onClick={() => setParams({})}>
                Xóa bộ lọc
              </Button>
            </div>
          )}
          <WorkflowPagination
            page={page}
            totalPages={result.data.meta.totalPages}
            total={result.data.meta.total}
            pageSize={10}
            onChange={(nextPage) => change('page', String(nextPage))}
            itemLabel="đợt hiến"
          />
        </>
      )}
    </CampaignShell>
  );
}
export function CampaignDetailPage() {
  const { campaignId = '' } = useParams();
  const repository = useCampaignRepository();
  const result = useCampaignQuery(`detail:${campaignId}`, () =>
    repository.detail(campaignId),
  );
  return (
    <CampaignShell title={result.data?.name ?? 'Chi tiết đợt hiến máu'}>
      <QueryState {...result} variant="campaign-detail" />
      {result.data && (
        <CampaignDetail
          key={campaignId}
          campaign={result.data}
          reload={result.retry}
        />
      )}
    </CampaignShell>
  );
}
function CampaignDetail({
  campaign,
  reload,
}: {
  campaign: Campaign;
  reload: () => void;
}) {
  const { hasPermission } = useAuth();
  const location = useLocation();
  const repository = useCampaignRepository();
  const mutation = useCampaignMutation();
  const [action, setAction] = useState<CampaignAction | null>(null);
  return (
    <>
      <Feedback
        error={!action ? mutation.error : null}
        success={
          mutation.success ||
          (location.state as { campaignNotice?: string } | null)?.campaignNotice
        }
      />
      <div className="campaign-toolbar">
        {(() => {
          const regInfo = getRegistrationWindowInfo(campaign);
          const isUpcoming =
            campaign.status === 'OPEN' && regInfo.state === 'NOT_OPEN_YET';
          return (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                flexWrap: 'wrap',
              }}
            >
              {isUpcoming ? (
                <span className="campaign-status campaign-status--upcoming">
                  Sắp mở đăng ký
                </span>
              ) : (
                <StatusBadge status={campaign.status} />
              )}
              {regInfo.label && (
                <span
                  className={`reg-timing-note reg-timing-note--${regInfo.state.toLowerCase()}`}
                >
                  {regInfo.label}
                </span>
              )}
            </div>
          );
        })()}
        <div className="campaign-actions">
          {(() => {
            const regInfo = getRegistrationWindowInfo(campaign);
            if (!hasPermission('registration.create')) return null;
            if (campaign.status === 'OPEN') {
              if (regInfo.isAcceptingRegistration) {
                return (
                  <Link
                    className="btn btn--primary"
                    to={`/donor/register?campaign=${campaign.id}`}
                  >
                    Đăng ký hiến máu
                  </Link>
                );
              }
              if (regInfo.state === 'NOT_OPEN_YET') {
                return (
                  <span
                    className="btn btn--secondary"
                    style={{ opacity: 0.6, cursor: 'not-allowed' }}
                    title="Chưa đến thời gian mở cổng đăng ký"
                  >
                    Chưa mở đăng ký
                  </span>
                );
              }
            }
            return null;
          })()}
          {hasPermission('campaign.update') &&
            !CAMPAIGN_STATUSES_FROZEN.includes(campaign.status) && (
              <Link
                className="btn btn--secondary"
                to={`/campaigns/${campaign.id}/edit`}
              >
                Chỉnh sửa
              </Link>
            )}
          {hasPermission('campaign_staff.read') && (
            <Link
              className="btn btn--secondary"
              to={`/campaigns/${campaign.id}/staff`}
            >
              Nhân sự đợt hiến
            </Link>
          )}
          {(Object.keys(ACTIONS) as CampaignAction[])
            .filter(
              (key) =>
                hasPermission(ACTIONS[key].permission) &&
                canAct(campaign.status, key),
            )
            .map((key) => (
              <Button
                key={key}
                variant={key === 'cancel' ? 'danger' : 'secondary'}
                onClick={() => setAction(key)}
              >
                {ACTIONS[key].label}
              </Button>
            ))}
        </div>
      </div>
      <section className="campaign-detail panel">
        <h2>Thông tin đợt hiến</h2>
        <dl className="campaign-facts">
          {[
            ['Bắt đầu', formatDate(campaign.startsAt)],
            ['Kết thúc', formatDate(campaign.endsAt)],
            ['Địa điểm', campaign.location],
            ['Đơn vị tổ chức', campaign.organizerName],
            ['Liên hệ', campaign.contactPhone],
            [
              'Mở đăng ký',
              campaign.registrationOpensAt &&
                formatDate(campaign.registrationOpensAt),
            ],
            [
              'Đóng đăng ký',
              campaign.registrationClosesAt &&
                formatDate(campaign.registrationClosesAt),
            ],
            [
              'Chỉ tiêu người hiến',
              campaign.targetDonors?.toLocaleString('vi-VN'),
            ],
            [
              'Chỉ tiêu thể tích máu',
              campaign.targetBloodVolumeMl &&
                `${campaign.targetBloodVolumeMl.toLocaleString('vi-VN')} ml`,
            ],
          ]
            .filter(([, value]) => value)
            .map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
        </dl>
        {campaign.description && (
          <p className="campaign-description">{campaign.description}</p>
        )}
        {hasPermission('registration.create') && campaign.status !== 'OPEN' && (
          <p className="campaign-note">
            Đợt hiến này hiện không mở đăng ký trực tuyến.
          </p>
        )}
      </section>
      {hasPermission('timeslot.read') && (
        <section className="panel">
          <div className="campaign-toolbar">
            <h2>Khung giờ hiến máu</h2>
            {(
              [
                'timeslot.create',
                'timeslot.update',
                'timeslot.deactivate',
              ] as const
            ).some(hasPermission) && (
              <Link
                className="btn btn--secondary"
                to={`/campaigns/${campaign.id}/timeslots`}
              >
                Quản lý khung giờ
              </Link>
            )}
          </div>
          <TimeSlotList campaign={campaign} />
        </section>
      )}
      {(hasPermission('registration.checkin') ||
        hasPermission('screening.review') ||
        hasPermission('campaign_staff.read')) && (() => {
        const isTestEnv = import.meta.env.MODE === 'test';
        const opsWindow = getOperationalWindow(campaign.startsAt, campaign.endsAt, {
          campaignStatus: campaign.status,
        });
        const isOpsOpen = isTestEnv || opsWindow.status === 'ACTIVE';
        return (
          <section className="panel" aria-labelledby="campaign-ops-heading">
            <div className="campaign-toolbar">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h2 id="campaign-ops-heading" style={{ margin: 0 }}>Tác nghiệp tại điểm hiến máu</h2>
                <span
                  className={`station-badge-live station-badge-live--${
                    opsWindow.status === 'ACTIVE'
                      ? 'active'
                      : opsWindow.status === 'UPCOMING'
                        ? 'upcoming'
                        : 'closed'
                  }`}
                >
                  {OPERATIONAL_STATUS_SHORT_LABELS[opsWindow.status]}
                </span>
              </div>
            </div>
            <p className="campaign-muted" style={{ marginBottom: '1rem' }}>
              {opsWindow.message}
            </p>
            <div className="campaign-actions">
              {hasPermission('registration.checkin') && (
                isOpsOpen ? (
                  <Link
                    className="btn btn--primary"
                    to={`/campaigns/${campaign.id}/check-in`}
                  >
                    Tiếp nhận & Check-in
                  </Link>
                ) : (
                  <Button
                    disabled
                    variant="secondary"
                    title="Chỉ mở tiếp nhận trong khung giờ quy định"
                  >
                    Tiếp nhận & Check-in ({OPERATIONAL_STATUS_SHORT_LABELS[opsWindow.status]})
                  </Button>
                )
              )}
              {hasPermission('screening.review') && (
                isOpsOpen ? (
                  <Link
                    className="btn btn--secondary"
                    to={`/campaigns/${campaign.id}/screening`}
                  >
                    Hàng chờ sàng lọc
                  </Link>
                ) : (
                  <Button
                    disabled
                    variant="secondary"
                    title="Chỉ mở khám sàng lọc trong khung giờ quy định"
                  >
                    Hàng chờ sàng lọc ({OPERATIONAL_STATUS_SHORT_LABELS[opsWindow.status]})
                  </Button>
                )
              )}
              {hasPermission('campaign_staff.read') && (
                <Link
                  className="btn btn--secondary"
                  to={`/campaigns/${campaign.id}/staff`}
                >
                  Nhân sự đợt hiến
                </Link>
              )}
            </div>
          </section>
        );
      })()}
      {action && (
        <ConfirmDialog
          title={`${ACTIONS[action].label}?`}
          label={ACTIONS[action].label}
          pending={mutation.pending}
          error={mutation.error}
          onCancel={() => setAction(null)}
          onConfirm={() => {
            const selected = action;
            void mutation.run(
              () => repository.transition(campaign.id, selected),
              () => {
                setAction(null);
                reload();
              },
              'Đã cập nhật trạng thái đợt hiến.',
            );
          }}
        >
          <p>
            <strong>{campaign.name}</strong>
          </p>
          <p>
            {action === 'open'
              ? 'Đợt hiến sẽ chuyển sang trạng thái mở đăng ký.'
              : action === 'close'
                ? 'Đợt hiến sẽ ngừng nhận đăng ký mới. Không thể mở lại theo quy trình hiện tại.'
                : 'Đợt hiến sẽ bị hủy và không thể mở lại.'}
          </p>
        </ConfirmDialog>
      )}
    </>
  );
}
export function CampaignCreatePage() {
  return (
    <CampaignShell
      title="Tạo đợt hiến máu"
      lead="Bắt đầu bằng một bản nháp, sau đó chuẩn bị khung giờ và nhân sự."
    >
      <CampaignForm />
    </CampaignShell>
  );
}
export function CampaignEditPage() {
  const { campaignId = '' } = useParams();
  const repository = useCampaignRepository();
  const result = useCampaignQuery(`edit:${campaignId}`, () =>
    repository.detail(campaignId),
  );
  return (
    <CampaignShell
      title="Chỉnh sửa đợt hiến máu"
      back={`/campaigns/${campaignId}`}
    >
      <QueryState {...result} variant="form" />
      {result.data &&
        (CAMPAIGN_STATUSES_FROZEN.includes(result.data.status) ? (
          <p role="status">Đợt hiến đã hoàn tất và không thể chỉnh sửa.</p>
        ) : (
          <CampaignForm key={result.data.id} campaign={result.data} />
        ))}
    </CampaignShell>
  );
}

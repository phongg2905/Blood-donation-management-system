import { useMemo, useState } from 'react';
import {
  Link,
  useLocation,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { Calendar, Clock, MapPin, Target, Users } from 'lucide-react';
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

type ManagerViewPerspective = 'operational' | 'registration';
type OperationalQuickTab = 'ALL' | 'ACTIVE_TODAY' | 'UPCOMING' | 'DRAFT' | 'PAST';
type RegistrationQuickTab = 'ALL' | 'OPEN_REG' | 'UPCOMING_REG' | 'CLOSED_REG' | 'DRAFT' | 'FINISHED';

function formatEventWindowLabel(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();
  const timeFmt = new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const dateFmt = new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  if (sameDay) {
    return `${timeFmt.format(start)} – ${timeFmt.format(end)}, ${dateFmt.format(start)}`;
  }
  return `${formatDate(startsAt)} – ${formatDate(endsAt)}`;
}

export function CampaignListPage() {
  const repository = useCampaignRepository();
  const { hasPermission } = useAuth();
  const isManager = hasPermission('campaign.create');
  const [params, setParams] = useSearchParams();
  const status = params.get('status');
  const perspectiveParam = params.get('view');
  const perspective: ManagerViewPerspective =
    perspectiveParam === 'registration' ? 'registration' : 'operational';
  const opTabParam = (params.get('opTab') as OperationalQuickTab) || 'ALL';
  const regTabParam = (params.get('regTab') as RegistrationQuickTab) || 'ALL';

  const requestedPage = Number(params.get('page'));
  const page =
    Number.isSafeInteger(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1;
  const isUpcoming = status === 'UPCOMING';
  const hasExplicitSort = params.has('sort');
  const sortDirection = params.get('sort') === 'desc' ? 'desc' : 'asc';

  const query: CampaignQuery = {
    page: isManager ? 1 : page,
    limit: isManager ? 50 : 10,
    search: params.get('search') ?? '',
    ...(isUpcoming
      ? { status: 'UPCOMING' }
      : CAMPAIGN_STATUSES.includes(status as CampaignStatus)
        ? { status: status as CampaignStatus }
        : {}),
    ...(params.get('from') ? { from: params.get('from')! } : {}),
    ...(params.get('to') ? { to: params.get('to')! } : {}),
    sort: sortDirection,
  };
  const result = useCampaignQuery(`list:${isManager ? 'mgr' : 'donor'}:${params}`, () =>
    repository.list(query),
  );
  function change(name: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value);
    else next.delete(name);
    if (name !== 'page') next.delete('page');
    setParams(next);
  }
  function switchPerspective(nextView: ManagerViewPerspective) {
    const next = new URLSearchParams(params);
    if (nextView === 'operational') {
      next.delete('view');
      next.delete('regTab');
    } else {
      next.set('view', 'registration');
      next.delete('opTab');
    }
    next.delete('page');
    setParams(next);
  }

  // Enrich & sort campaigns for Manager dual-perspective UX
  const managerViewData = useMemo(() => {
    if (!result.data) return null;
    const rawItems = result.data.items;
    const searchTerm = (query.search ?? '').trim().toLocaleLowerCase('vi');

    const enriched = rawItems
      .filter((c) => {
        if (!searchTerm) return true;
        return `${c.name} ${c.location} ${c.description ?? ''}`
          .toLocaleLowerCase('vi')
          .includes(searchTerm);
      })
      .map((campaign) => {
        const opWindow = getOperationalWindow(campaign.startsAt, campaign.endsAt, {
          campaignStatus: campaign.status,
        });
        const regInfo = getRegistrationWindowInfo(campaign);
        const isOperationalActive =
          opWindow.status === 'ACTIVE' &&
          campaign.status !== 'DRAFT' &&
          campaign.status !== 'CANCELLED';
        const isOperationalUpcoming =
          opWindow.status === 'UPCOMING' &&
          campaign.status !== 'DRAFT' &&
          campaign.status !== 'CANCELLED' &&
          campaign.status !== 'COMPLETED';
        const isDraft = campaign.status === 'DRAFT';
        const isPastOrClosedEvent =
          !isOperationalActive && !isOperationalUpcoming && !isDraft;

        return {
          campaign,
          opWindow,
          regInfo,
          isOperationalActive,
          isOperationalUpcoming,
          isDraft,
          isPastOrClosedEvent,
        };
      });

    const opCounts = {
      ALL: enriched.length,
      ACTIVE_TODAY: enriched.filter((x) => x.isOperationalActive).length,
      UPCOMING: enriched.filter((x) => x.isOperationalUpcoming).length,
      DRAFT: enriched.filter((x) => x.isDraft).length,
      PAST: enriched.filter((x) => x.isPastOrClosedEvent).length,
    };

    const regCounts = {
      ALL: enriched.length,
      OPEN_REG: enriched.filter(
        (x) => x.campaign.status === 'OPEN' && x.regInfo.isAcceptingRegistration,
      ).length,
      UPCOMING_REG: enriched.filter(
        (x) => x.campaign.status === 'OPEN' && x.regInfo.state === 'NOT_OPEN_YET',
      ).length,
      CLOSED_REG: enriched.filter((x) => x.campaign.status === 'CLOSED').length,
      DRAFT: enriched.filter((x) => x.campaign.status === 'DRAFT').length,
      FINISHED: enriched.filter(
        (x) =>
          x.campaign.status === 'COMPLETED' || x.campaign.status === 'CANCELLED',
      ).length,
    };

    let filtered = enriched;
    if (isManager) {
      if (perspective === 'operational') {
        if (opTabParam === 'ACTIVE_TODAY') {
          filtered = enriched.filter((x) => x.isOperationalActive);
        } else if (opTabParam === 'UPCOMING') {
          filtered = enriched.filter((x) => x.isOperationalUpcoming);
        } else if (opTabParam === 'DRAFT') {
          filtered = enriched.filter((x) => x.isDraft);
        } else if (opTabParam === 'PAST') {
          filtered = enriched.filter((x) => x.isPastOrClosedEvent);
        }
      } else {
        if (regTabParam === 'OPEN_REG') {
          filtered = enriched.filter(
            (x) =>
              x.campaign.status === 'OPEN' && x.regInfo.isAcceptingRegistration,
          );
        } else if (regTabParam === 'UPCOMING_REG') {
          filtered = enriched.filter(
            (x) =>
              x.campaign.status === 'OPEN' && x.regInfo.state === 'NOT_OPEN_YET',
          );
        } else if (regTabParam === 'CLOSED_REG') {
          filtered = enriched.filter((x) => x.campaign.status === 'CLOSED');
        } else if (regTabParam === 'DRAFT') {
          filtered = enriched.filter((x) => x.campaign.status === 'DRAFT');
        } else if (regTabParam === 'FINISHED') {
          filtered = enriched.filter(
            (x) =>
              x.campaign.status === 'COMPLETED' ||
              x.campaign.status === 'CANCELLED',
          );
        }
      }
    }

    const sorted = [...filtered].sort((a, b) => {
      if (!isManager) return 0;
      if (hasExplicitSort) {
        const diff =
          Date.parse(a.campaign.startsAt) - Date.parse(b.campaign.startsAt);
        return sortDirection === 'desc' ? -diff : diff;
      }

      if (perspective === 'operational') {
        const rank = (item: typeof a) => {
          if (item.isOperationalActive) return 0; // Đang diễn ra hôm nay (kể cả CLOSED đăng ký)
          if (item.isOperationalUpcoming) return 1; // Sắp tổ chức
          if (item.isDraft) return 2; // Bản nháp cần hoàn thiện
          return 3; // Đã kết thúc / Đã hoàn tất / Đã hủy
        };
        const rA = rank(a);
        const rB = rank(b);
        if (rA !== rB) return rA - rB;
        const tA = Date.parse(a.campaign.startsAt);
        const tB = Date.parse(b.campaign.startsAt);
        // Active & Upcoming: nearest date first; Past: most recent first
        return rA <= 2 ? tA - tB : tB - tA;
      } else {
        const regRank = (item: typeof a) => {
          if (
            item.campaign.status === 'OPEN' &&
            item.regInfo.isAcceptingRegistration
          )
            return 0;
          if (
            item.campaign.status === 'OPEN' &&
            item.regInfo.state === 'NOT_OPEN_YET'
          )
            return 1;
          if (item.campaign.status === 'CLOSED') return 2;
          if (item.campaign.status === 'DRAFT') return 3;
          return 4;
        };
        const rA = regRank(a);
        const rB = regRank(b);
        if (rA !== rB) return rA - rB;
        const tA = Date.parse(a.campaign.startsAt);
        const tB = Date.parse(b.campaign.startsAt);
        return rA <= 3 ? tA - tB : tB - tA;
      }
    });

    const PAGE_SIZE = 10;
    const total = isManager ? sorted.length : result.data.meta.total;
    const totalPages = isManager
      ? Math.max(1, Math.ceil(total / PAGE_SIZE))
      : result.data.meta.totalPages;
    const safePage = Math.min(Math.max(1, page), totalPages);
    const pageItems = isManager
      ? sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
      : sorted;

    return {
      items: pageItems,
      total,
      totalPages,
      safePage,
      opCounts,
      regCounts,
    };
  }, [
    result.data,
    query.search,
    isManager,
    perspective,
    opTabParam,
    regTabParam,
    hasExplicitSort,
    sortDirection,
    page,
  ]);

  return (
    <CampaignShell>
      <div className="campaign-toolbar">
        <h2>Đợt hiến máu</h2>
        <div className="campaign-toolbar__actions">
          {isManager && (
            <div
              className="campaign-perspective-switch"
              role="tablist"
              aria-label="Chế độ hiển thị quản lý"
            >
              <button
                type="button"
                role="tab"
                aria-selected={perspective === 'operational'}
                className={`campaign-perspective-btn ${
                  perspective === 'operational'
                    ? 'campaign-perspective-btn--active'
                    : ''
                }`}
                onClick={() => switchPerspective('operational')}
              >
                <Calendar size={14} />
                <span>Theo lịch tổ chức</span>
                {managerViewData && managerViewData.opCounts.ACTIVE_TODAY > 0 && (
                  <span className="campaign-perspective-btn__live-badge">
                    {managerViewData.opCounts.ACTIVE_TODAY}
                  </span>
                )}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={perspective === 'registration'}
                className={`campaign-perspective-btn ${
                  perspective === 'registration'
                    ? 'campaign-perspective-btn--active'
                    : ''
                }`}
                onClick={() => switchPerspective('registration')}
              >
                <Clock size={14} />
                <span>Theo cổng đăng ký</span>
              </button>
            </div>
          )}
          {isManager && (
            <Link className="btn btn--primary" to="/campaigns/new">
              Tạo đợt hiến
            </Link>
          )}
        </div>
      </div>

      {/* Clean Quick Status Tabs for Manager */}
      {isManager && managerViewData && (
        <div
          className="campaign-quick-pills"
          role="tablist"
          aria-label={
            perspective === 'operational'
              ? 'Lọc theo tiến độ tổ chức'
              : 'Lọc theo trạng thái cổng đăng ký'
          }
        >
          {perspective === 'operational'
            ? (
                [
                  { id: 'ALL', label: 'Tất cả', count: managerViewData.opCounts.ALL },
                  {
                    id: 'ACTIVE_TODAY',
                    label: 'Diễn ra hôm nay',
                    count: managerViewData.opCounts.ACTIVE_TODAY,
                    highlight: true,
                  },
                  {
                    id: 'UPCOMING',
                    label: 'Sắp tổ chức',
                    count: managerViewData.opCounts.UPCOMING,
                  },
                  {
                    id: 'DRAFT',
                    label: 'Bản nháp',
                    count: managerViewData.opCounts.DRAFT,
                  },
                  {
                    id: 'PAST',
                    label: 'Đã kết thúc',
                    count: managerViewData.opCounts.PAST,
                  },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={opTabParam === tab.id}
                  className={`campaign-quick-pill ${
                    opTabParam === tab.id ? 'campaign-quick-pill--active' : ''
                  } ${'highlight' in tab && tab.highlight ? 'campaign-quick-pill--live' : ''}`}
                  onClick={() => change('opTab', tab.id === 'ALL' ? '' : tab.id)}
                >
                  <span>{tab.label}</span>
                  <span className="campaign-quick-pill__badge">{tab.count}</span>
                </button>
              ))
            : (
                [
                  { id: 'ALL', label: 'Tất cả', count: managerViewData.regCounts.ALL },
                  {
                    id: 'OPEN_REG',
                    label: 'Đang mở đăng ký',
                    count: managerViewData.regCounts.OPEN_REG,
                  },
                  {
                    id: 'UPCOMING_REG',
                    label: 'Sắp mở cổng',
                    count: managerViewData.regCounts.UPCOMING_REG,
                  },
                  {
                    id: 'CLOSED_REG',
                    label: 'Đã đóng đăng ký',
                    count: managerViewData.regCounts.CLOSED_REG,
                  },
                  {
                    id: 'DRAFT',
                    label: 'Bản nháp',
                    count: managerViewData.regCounts.DRAFT,
                  },
                  {
                    id: 'FINISHED',
                    label: 'Đã hoàn tất / Hủy',
                    count: managerViewData.regCounts.FINISHED,
                  },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={regTabParam === tab.id}
                  className={`campaign-quick-pill ${
                    regTabParam === tab.id ? 'campaign-quick-pill--active' : ''
                  }`}
                  onClick={() => change('regTab', tab.id === 'ALL' ? '' : tab.id)}
                >
                  <span>{tab.label}</span>
                  <span className="campaign-quick-pill__badge">{tab.count}</span>
                </button>
              ))}
        </div>
      )}

      <form
        className="campaign-filters"
        onSubmit={(event) => event.preventDefault()}
      >
        <div className="campaign-filter-search">
          <FormField id="campaign-search" label="Tìm kiếm">
            <Input
              type="search"
              value={query.search}
              placeholder="Tên đợt hiến hoặc địa điểm..."
              onChange={(event) => change('search', event.target.value)}
            />
          </FormField>
        </div>
        {!isManager && (
          <div className="campaign-filter-status">
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
              </select>
            </FormField>
          </div>
        )}
        <div className="campaign-filter-date">
          <FormField id="campaign-from" label="Từ ngày">
            <Input
              type="date"
              value={query.from ?? ''}
              onChange={(event) => change('from', event.target.value)}
            />
          </FormField>
        </div>
        <div className="campaign-filter-date">
          <FormField id="campaign-to" label="Đến ngày">
            <Input
              type="date"
              min={query.from}
              value={query.to ?? ''}
              onChange={(event) => change('to', event.target.value)}
            />
          </FormField>
        </div>
        <div className="campaign-filter-sort">
          <FormField id="campaign-sort" label="Sắp xếp">
            <select
              className="input"
              value={hasExplicitSort ? sortDirection : isManager ? '' : 'asc'}
              onChange={(event) => change('sort', event.target.value)}
            >
              {isManager && (
                <option value="">
                  {perspective === 'operational'
                    ? 'Theo mức ưu tiên tổ chức'
                    : 'Theo mức ưu tiên đăng ký'}
                </option>
              )}
              <option value="asc">Thời gian tăng dần</option>
              <option value="desc">Thời gian giảm dần</option>
            </select>
          </FormField>
        </div>
        <Button
          variant="ghost"
          className="campaign-filter-reset"
          onClick={() => setParams({})}
        >
          Xóa bộ lọc
        </Button>
      </form>
      <QueryState {...result} variant="campaign-list" count={4} />
      {!result.loading && result.data && managerViewData && (
        <>
          <div className="campaign-results-bar" role="status">
            <span>
              Hiển thị <strong>{managerViewData.total}</strong> đợt hiến máu
            </span>
          </div>
          {managerViewData.items.length ? (
            <div className="campaign-list">
              {managerViewData.items.map(
                ({
                  campaign,
                  regInfo,
                  isOperationalActive,
                  isOperationalUpcoming,
                }) => {
                  const isUpcomingReg =
                    campaign.status === 'OPEN' &&
                    regInfo.state === 'NOT_OPEN_YET';
                  const assignedCount = campaign.staffAssignments?.length ?? 0;
                  const targetLitres = campaign.targetBloodVolumeMl
                    ? `${(campaign.targetBloodVolumeMl / 1000).toFixed(
                        campaign.targetBloodVolumeMl % 1000 === 0 ? 0 : 1,
                      )} Lít`
                    : null;

                  return (
                    <article
                      className={`campaign-row ${
                        isManager && isOperationalActive
                          ? 'campaign-row--active-today'
                          : ''
                      }`}
                      key={campaign.id}
                    >
                      <div className="campaign-row__main">
                        <div className="campaign-row__badges">
                          {isManager && perspective === 'operational' ? (
                            isOperationalActive ? (
                              <span className="campaign-op-badge campaign-op-badge--active">
                                <span className="campaign-op-badge__dot" />
                                Đang diễn ra hôm nay
                              </span>
                            ) : isOperationalUpcoming ? (
                              <span className="campaign-op-badge campaign-op-badge--upcoming">
                                Sắp tổ chức
                              </span>
                            ) : campaign.status === 'DRAFT' ? (
                              <StatusBadge status="DRAFT" />
                            ) : campaign.status === 'CANCELLED' ? (
                              <StatusBadge status="CANCELLED" />
                            ) : (
                              <span className="campaign-status campaign-status--completed">
                                Đã kết thúc
                              </span>
                            )
                          ) : (
                            <>
                              {isUpcomingReg ? (
                                <span className="campaign-status campaign-status--upcoming">
                                  Sắp mở đăng ký
                                </span>
                              ) : (
                                <StatusBadge status={campaign.status} />
                              )}
                              {regInfo.label && (
                                <span className="campaign-reg-subtle-note">
                                  {regInfo.label}
                                </span>
                              )}
                            </>
                          )}
                        </div>

                        <h2>
                          <Link to={`/campaigns/${campaign.id}`}>
                            {campaign.name}
                          </Link>
                        </h2>

                        <p className="campaign-location-line">
                          <MapPin size={14} style={{ flexShrink: 0, opacity: 0.65 }} />
                          <span>{campaign.location}</span>
                        </p>

                        {campaign.description && (
                          <p className="campaign-muted campaign-row__desc">
                            {campaign.description}
                          </p>
                        )}

                        {isManager && (
                          <div className="campaign-manager-meta">
                            <span className="campaign-manager-meta__item campaign-manager-meta__item--time">
                              <Clock size={14} />
                              <span>
                                {formatEventWindowLabel(
                                  campaign.startsAt,
                                  campaign.endsAt,
                                )}
                              </span>
                            </span>
                            {(campaign.targetDonors || targetLitres) && (
                              <span className="campaign-manager-meta__item">
                                <Target size={14} />
                                <span>
                                  Chỉ tiêu:{' '}
                                  <strong>
                                    {[
                                      campaign.targetDonors
                                        ? `${campaign.targetDonors} người`
                                        : null,
                                      targetLitres,
                                    ]
                                      .filter(Boolean)
                                      .join(' · ')}
                                  </strong>
                                </span>
                              </span>
                            )}
                            {Array.isArray(campaign.staffAssignments) && (
                              <span
                                className={`campaign-manager-meta__item ${
                                  assignedCount === 0
                                    ? 'campaign-manager-meta__item--warn'
                                    : ''
                                }`}
                              >
                                <Users size={14} />
                                <span>
                                  {assignedCount > 0 ? (
                                    <>
                                      Nhân sự: <strong>{assignedCount} người</strong>
                                    </>
                                  ) : (
                                    'Chưa phân công nhân sự'
                                  )}
                                </span>
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="campaign-row-aside">
                        {!isManager && (
                          <time dateTime={campaign.startsAt}>
                            Bắt đầu: {formatDate(campaign.startsAt)}
                          </time>
                        )}
                        {(() => {
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
                        {isManager ? (
                          <div className="campaign-manager-actions">
                            <Link
                              className={`btn ${
                                isOperationalActive
                                  ? 'btn--primary'
                                  : 'btn--secondary'
                              } campaign-manager-actions__main`}
                              to={`/campaigns/${campaign.id}`}
                            >
                              Xem chi tiết
                            </Link>
                            <div className="campaign-manager-actions__sub">
                              <Link
                                className="campaign-sub-btn"
                                to={`/campaigns/${campaign.id}/staff`}
                              >
                                Nhân sự
                              </Link>
                              <Link
                                className="campaign-sub-btn"
                                to={`/campaigns/${campaign.id}/timeslots`}
                              >
                                Khung giờ
                              </Link>
                            </div>
                          </div>
                        ) : (
                          <Link
                            className="btn btn--secondary"
                            to={`/campaigns/${campaign.id}`}
                          >
                            Xem chi tiết
                          </Link>
                        )}
                      </div>
                    </article>
                  );
                },
              )}
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
            page={managerViewData.safePage}
            totalPages={managerViewData.totalPages}
            total={managerViewData.total}
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
    <CampaignShell title="Tạo đợt hiến máu">
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

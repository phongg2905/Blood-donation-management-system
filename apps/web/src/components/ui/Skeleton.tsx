import type { CSSProperties } from 'react';

export interface SkeletonProps {
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  className?: string;
  style?: CSSProperties;
}

/** Base atomic skeleton with shimmer animation. */
export function Skeleton({
  variant = 'text',
  width,
  height,
  borderRadius,
  className = '',
  style,
}: SkeletonProps) {
  const inlineStyles: CSSProperties = {
    ...style,
    ...(width !== undefined ? { width: typeof width === 'number' ? `${width}px` : width } : {}),
    ...(height !== undefined ? { height: typeof height === 'number' ? `${height}px` : height } : {}),
    ...(borderRadius !== undefined
      ? { borderRadius: typeof borderRadius === 'number' ? `${borderRadius}px` : borderRadius }
      : {}),
  };

  return (
    <span
      className={`skeleton skeleton--${variant} ${className}`.trim()}
      style={inlineStyles}
      aria-hidden="true"
    />
  );
}

/** Skeleton for list items (campaigns, queues, appointments). */
export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="skeleton-list" role="status" aria-label="Đang tải dữ liệu…">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="skeleton-card-item">
          <div className="skeleton-card-item__main">
            <div className="skeleton-card-item__header">
              <Skeleton width="80px" height="22px" borderRadius="999px" />
              <Skeleton width="60%" height="22px" borderRadius="6px" />
            </div>
            <div className="skeleton-card-item__body">
              <Skeleton width="45%" height="16px" />
              <Skeleton width="75%" height="15px" />
            </div>
          </div>
          <div className="skeleton-card-item__aside">
            <Skeleton width="110px" height="15px" />
            <div style={{ display: 'flex', gap: '8px' }}>
              <Skeleton width="100px" height="34px" borderRadius="8px" />
              <Skeleton width="90px" height="34px" borderRadius="8px" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Skeleton precisely matching .workflow-list and .workflow-list__item (CheckInPage, ScreeningPage). */
export function SkeletonWorkflowList({ count = 3 }: { count?: number }) {
  return (
    <div className="skeleton-workflow-list" role="status" aria-label="Đang tải dữ liệu…">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="skeleton-workflow-item">
          <div className="skeleton-workflow-item__main">
            <Skeleton width="180px" height="20px" borderRadius="4px" />
            <div className="skeleton-workflow-item__meta">
              <Skeleton width="90px" height="14px" />
              <Skeleton width="130px" height="14px" />
              <Skeleton width="110px" height="14px" />
            </div>
            <Skeleton width="140px" height="14px" />
          </div>
          <div className="skeleton-workflow-item__side">
            <Skeleton width="86px" height="24px" borderRadius="999px" />
            <div style={{ display: 'flex', gap: '6px' }}>
              <Skeleton width="96px" height="32px" borderRadius="8px" />
              <Skeleton width="60px" height="32px" borderRadius="8px" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Skeleton precisely matching .campaign-list and .campaign-row (CampaignListPage). */
export function SkeletonCampaignList({ count = 3 }: { count?: number }) {
  return (
    <div className="skeleton-campaign-list" role="status" aria-label="Đang tải dữ liệu…">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="skeleton-campaign-row">
          <div className="skeleton-campaign-row__main">
            <Skeleton width="75px" height="20px" borderRadius="999px" />
            <Skeleton width="240px" height="22px" borderRadius="4px" />
            <Skeleton width="180px" height="15px" />
            <Skeleton width="340px" height="14px" />
          </div>
          <div className="skeleton-campaign-row__aside">
            <Skeleton width="100px" height="15px" />
            <div style={{ display: 'flex', gap: '8px' }}>
              <Skeleton width="120px" height="34px" borderRadius="8px" />
              <Skeleton width="100px" height="34px" borderRadius="8px" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Skeleton precisely matching .ready-donor-card (BloodBagPages). */
export function SkeletonReadyQueue({ count = 3 }: { count?: number }) {
  return (
    <div className="skeleton-ready-queue" role="status" aria-label="Đang tải dữ liệu…">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="skeleton-ready-card">
          <div className="skeleton-ready-card__info">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Skeleton width="160px" height="20px" borderRadius="4px" />
              <Skeleton width="90px" height="20px" borderRadius="999px" />
            </div>
            <div className="skeleton-ready-card__tags">
              <Skeleton width="80px" height="14px" />
              <Skeleton width="100px" height="14px" />
              <Skeleton width="120px" height="14px" />
              <Skeleton width="140px" height="14px" />
            </div>
          </div>
          <Skeleton width="140px" height="38px" borderRadius="8px" />
        </div>
      ))}
    </div>
  );
}

/** Skeleton for data tables (Admin Users, Audit Logs, Settings, Reports, Permissions, Blood Bags). */
export function SkeletonTable({
  rows = 5,
  columns = 4,
}: {
  rows?: number;
  columns?: number;
}) {
  const columnWidthsMap: Record<number, string[]> = {
    8: ['13%', '15%', '16%', '10%', '10%', '12%', '12%', '12%'],
    6: ['18%', '22%', '18%', '16%', '14%', '12%'],
    5: ['20%', '25%', '20%', '18%', '17%'],
    4: ['25%', '30%', '25%', '20%'],
    2: ['40%', '60%'],
  };
  const widths = columnWidthsMap[columns] ?? Array.from({ length: columns }, () => `${Math.floor(100 / columns)}%`);

  return (
    <div className="skeleton-table-wrap" role="status" aria-label="Đang tải dữ liệu…">
      <div className="skeleton-table">
        <div className="skeleton-table__header">
          {Array.from({ length: columns }).map((_, colIdx) => (
            <div key={colIdx} className="skeleton-table__cell">
              <Skeleton
                width={widths[colIdx % widths.length]}
                height="16px"
                borderRadius="4px"
              />
            </div>
          ))}
        </div>
        <div className="skeleton-table__body">
          {Array.from({ length: rows }).map((_, rowIdx) => (
            <div key={rowIdx} className="skeleton-table__row">
              {Array.from({ length: columns }).map((_, colIdx) => (
                <div key={colIdx} className="skeleton-table__cell">
                  <Skeleton
                    width={
                      colIdx === 0
                        ? '65%'
                        : colIdx === columns - 1
                        ? '50%'
                        : colIdx === columns - 2
                        ? '40%'
                        : '80%'
                    }
                    height={colIdx === columns - 1 ? '28px' : '18px'}
                    borderRadius={colIdx === columns - 1 ? '6px' : '4px'}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Skeleton for card grids (e.g. general card layouts). */
export function SkeletonCard({ count = 3 }: { count?: number }) {
  return (
    <div className="skeleton-card-grid" role="status" aria-label="Đang tải dữ liệu…">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="skeleton-box-card">
          <Skeleton width="50%" height="20px" borderRadius="6px" />
          <Skeleton width="30%" height="14px" />
          <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <Skeleton width="100%" height="16px" />
            <Skeleton width="85%" height="16px" />
            <Skeleton width="65%" height="16px" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Skeleton for top KPI / stats widgets. */
export function SkeletonStats({ count = 4 }: { count?: number }) {
  return (
    <div className="skeleton-stats-grid" role="status" aria-label="Đang tải số liệu…">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="skeleton-stat-card">
          <Skeleton width="60%" height="14px" />
          <Skeleton width="45%" height="28px" borderRadius="6px" />
        </div>
      ))}
    </div>
  );
}

/** Skeleton for user profile / settings details. */
export function SkeletonProfile() {
  return (
    <div className="skeleton-profile" role="status" aria-label="Đang tải thông tin…">
      <div className="skeleton-profile__header">
        <Skeleton variant="circular" width="68px" height="68px" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
          <Skeleton width="220px" height="22px" borderRadius="6px" />
          <Skeleton width="140px" height="16px" />
        </div>
      </div>
      <div className="skeleton-profile__grid">
        <div className="skeleton-profile__field">
          <Skeleton width="90px" height="14px" />
          <Skeleton width="100%" height="38px" borderRadius="8px" />
        </div>
        <div className="skeleton-profile__field">
          <Skeleton width="110px" height="14px" />
          <Skeleton width="100%" height="38px" borderRadius="8px" />
        </div>
        <div className="skeleton-profile__field">
          <Skeleton width="80px" height="14px" />
          <Skeleton width="100%" height="38px" borderRadius="8px" />
        </div>
        <div className="skeleton-profile__field">
          <Skeleton width="100px" height="14px" />
          <Skeleton width="100%" height="38px" borderRadius="8px" />
        </div>
      </div>
    </div>
  );
}

/** Skeleton for form inputs (CampaignForm, edit screens). */
export function SkeletonForm({ fields = 8 }: { fields?: number }) {
  return (
    <div className="skeleton-form" role="status" aria-label="Đang tải biểu mẫu…">
      <div className="skeleton-form__grid">
        {Array.from({ length: fields }).map((_, idx) => (
          <div key={idx} className="skeleton-form__field">
            <Skeleton width="35%" height="14px" borderRadius="4px" />
            <Skeleton width="100%" height="38px" borderRadius="8px" />
          </div>
        ))}
      </div>
      <div className="skeleton-form__actions">
        <Skeleton width="130px" height="40px" borderRadius="8px" />
        <Skeleton width="100px" height="40px" borderRadius="8px" />
      </div>
    </div>
  );
}

/** Skeleton for CampaignDetailPage. */
export function SkeletonCampaignDetail() {
  return (
    <div className="skeleton-campaign-detail" role="status" aria-label="Đang tải chi tiết đợt hiến…">
      {/* Top Toolbar */}
      <div className="skeleton-campaign-detail__toolbar">
        <Skeleton width="90px" height="26px" borderRadius="999px" />
        <div style={{ display: 'flex', gap: '8px' }}>
          <Skeleton width="140px" height="38px" borderRadius="8px" />
          <Skeleton width="110px" height="38px" borderRadius="8px" />
          <Skeleton width="100px" height="38px" borderRadius="8px" />
        </div>
      </div>

      {/* Facts Panel */}
      <div className="skeleton-campaign-detail__panel">
        <Skeleton width="180px" height="22px" borderRadius="6px" />
        <div className="skeleton-campaign-detail__facts">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div key={idx} className="skeleton-campaign-detail__fact">
              <Skeleton width="85px" height="13px" />
              <Skeleton width="80%" height="18px" borderRadius="4px" />
            </div>
          ))}
        </div>
      </div>

      {/* Operational Window Panel */}
      <div className="skeleton-campaign-detail__panel">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Skeleton width="220px" height="22px" borderRadius="6px" />
          <Skeleton width="70px" height="22px" borderRadius="999px" />
        </div>
        <Skeleton width="60%" height="15px" />
        <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
          <Skeleton width="160px" height="38px" borderRadius="8px" />
          <Skeleton width="160px" height="38px" borderRadius="8px" />
          <Skeleton width="140px" height="38px" borderRadius="8px" />
        </div>
      </div>
    </div>
  );
}

/** Skeleton for medical screening evaluation form (ScreeningPage). */
export function SkeletonScreeningForm() {
  return (
    <div className="skeleton-screening-form" role="status" aria-label="Đang tải hồ sơ sàng lọc…">
      {/* Donor overview panel */}
      <div className="skeleton-screening-form__section">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Skeleton variant="circular" width="56px" height="56px" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
            <Skeleton width="220px" height="22px" borderRadius="6px" />
            <Skeleton width="160px" height="14px" />
          </div>
        </div>
      </div>

      {/* Vital signs section */}
      <div className="skeleton-screening-form__section">
        <Skeleton width="160px" height="20px" borderRadius="6px" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <Skeleton width="80px" height="13px" />
              <Skeleton width="100%" height="38px" borderRadius="8px" />
            </div>
          ))}
        </div>
      </div>

      {/* Rapid tests & conclusion */}
      <div className="skeleton-screening-form__section">
        <Skeleton width="180px" height="20px" borderRadius="6px" />
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <Skeleton width="120px" height="36px" borderRadius="8px" />
          <Skeleton width="120px" height="36px" borderRadius="8px" />
          <Skeleton width="120px" height="36px" borderRadius="8px" />
        </div>
        <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
          <Skeleton width="140px" height="42px" borderRadius="8px" />
          <Skeleton width="140px" height="42px" borderRadius="8px" />
        </div>
      </div>
    </div>
  );
}

/** Skeleton for compact workstation header (CheckInPage, ScreeningPage, BloodBagPages). */
export function SkeletonStationHeader() {
  return (
    <section className="station-compact-header" role="status" aria-label="Đang tải thông tin đợt tác nghiệp…">
      <div className="station-compact-header__main">
        <div className="station-compact-header__info">
          <div className="station-compact-header__title-group">
            <Skeleton width="220px" height="22px" borderRadius="6px" />
            <Skeleton width="65px" height="20px" borderRadius="999px" />
          </div>
          <div className="station-compact-header__meta" style={{ marginTop: '4px' }}>
            <Skeleton width="130px" height="14px" borderRadius="4px" />
            <span>·</span>
            <Skeleton width="180px" height="14px" borderRadius="4px" />
          </div>
        </div>
      </div>
      <div className="station-compact-nav">
        <Skeleton width="110px" height="28px" borderRadius="6px" />
        <Skeleton width="125px" height="28px" borderRadius="6px" />
        <Skeleton width="115px" height="28px" borderRadius="6px" />
      </div>
    </section>
  );
}

/** Skeleton for blood bag station grid (BloodBagPages). Matches .station-campaign-card 1:1 */
export function SkeletonStationGrid({ count = 3 }: { count?: number }) {
  return (
    <ul className="station-campaign-grid skeleton-station-grid" role="status" aria-label="Đang tải danh sách đợt hiến…">
      {Array.from({ length: count }).map((_, idx) => (
        <li key={idx} className="station-campaign-card skeleton-station-card" style={{ minHeight: '185px' }}>
          <div className="station-campaign-card__header skeleton-station-card__header">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
              <Skeleton width="68%" height="22px" borderRadius="6px" />
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                <Skeleton width="14px" height="14px" borderRadius="3px" />
                <Skeleton width="48%" height="14px" borderRadius="4px" />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Skeleton width="14px" height="14px" borderRadius="3px" />
                <Skeleton width="62%" height="14px" borderRadius="4px" />
              </div>
            </div>
            <div className="station-campaign-card__metrics">
              <Skeleton width="96px" height="26px" borderRadius="999px" />
            </div>
          </div>
          <div className="station-campaign-card__footer skeleton-station-card__footer">
            <Skeleton width="160px" height="14px" borderRadius="4px" />
            <Skeleton width="145px" height="36px" borderRadius="8px" />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Skeleton for donor history & test results (DonorHistoryPage). */
export function SkeletonHistoryList({ count = 2 }: { count?: number }) {
  return (
    <div role="status" aria-label="Đang tải lịch sử đặt hẹn…">
      {/* Tabs placeholder */}
      <div className="skeleton-history-tabs">
        <Skeleton width="100px" height="36px" borderRadius="8px" />
        <Skeleton width="100px" height="36px" borderRadius="8px" />
        <Skeleton width="100px" height="36px" borderRadius="8px" />
      </div>

      {/* Appointment cards */}
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="skeleton-history-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: '12px' }}>
            <Skeleton width="160px" height="18px" borderRadius="4px" />
            <Skeleton width="90px" height="24px" borderRadius="999px" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
            <div>
              <Skeleton width="110px" height="13px" style={{ marginBottom: '4px' }} />
              <Skeleton width="75%" height="16px" />
            </div>
            <div>
              <Skeleton width="110px" height="13px" style={{ marginBottom: '4px' }} />
              <Skeleton width="60%" height="16px" />
            </div>
            <div>
              <Skeleton width="110px" height="13px" style={{ marginBottom: '4px' }} />
              <Skeleton width="50%" height="16px" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Skeleton for Hospital Demand Cards on Landing Page. */
export function SkeletonDemandGrid({ count = 3 }: { count?: number }) {
  return (
    <div className="skeleton-demand-grid" role="status" aria-label="Đang tải nhu cầu bệnh viện…">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="skeleton-demand-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Skeleton className="skeleton--dark" width="60%" height="22px" borderRadius="6px" />
            <Skeleton className="skeleton--dark" width="70px" height="24px" borderRadius="999px" />
          </div>
          <Skeleton className="skeleton--dark" width="85%" height="14px" />
          <Skeleton className="skeleton--dark" width="45%" height="14px" />
          <div style={{ marginTop: '8px' }}>
            <Skeleton className="skeleton--dark" width="100%" height="8px" borderRadius="999px" />
          </div>
          <Skeleton className="skeleton--dark" width="100%" height="42px" borderRadius="10px" style={{ marginTop: '12px' }} />
        </div>
      ))}
    </div>
  );
}

/** Skeleton for Roles Matrix (Admin RolesPage). */
export function SkeletonRoleGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="skeleton-role-grid" role="status" aria-label="Đang tải danh sách vai trò…">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="skeleton-role-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Skeleton width="50%" height="20px" borderRadius="6px" />
            <Skeleton width="60px" height="18px" borderRadius="4px" />
          </div>
          <Skeleton width="40%" height="14px" />
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
            <Skeleton width="75px" height="22px" borderRadius="4px" />
            <Skeleton width="90px" height="22px" borderRadius="4px" />
            <Skeleton width="65px" height="22px" borderRadius="4px" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Skeleton for Authentication Form (LoginPage & RegisterPage). */
export function SkeletonAuthCard({ fields = 2 }: { fields?: number }) {
  return (
    <div className="skeleton-auth-card" role="status" aria-label="Đang tải form xác thực…">
      <Skeleton width="70px" height="14px" borderRadius="4px" />
      <Skeleton width="190px" height="26px" borderRadius="6px" />
      <Skeleton width="85%" height="15px" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
        {Array.from({ length: fields }).map((_, idx) => (
          <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <Skeleton width="30%" height="14px" />
            <Skeleton width="100%" height="40px" borderRadius="8px" />
          </div>
        ))}
        <Skeleton width="100%" height="44px" borderRadius="8px" style={{ marginTop: '8px' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '12px' }}>
        <Skeleton width="140px" height="14px" />
      </div>
    </div>
  );
}

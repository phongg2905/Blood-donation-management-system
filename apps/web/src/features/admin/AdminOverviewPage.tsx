import { Link } from 'react-router-dom';
import { Activity, AlertTriangle, Calendar, Droplets, Users } from 'lucide-react';
import { AdminShell } from './components';
import { useAdminQuery } from './hooks';
import { useAdminRepository } from './repository';
import type { AdminOverviewData } from './types';

function AdminOverviewSkeleton() {
  return (
    <>
      {/* 5 Widescreen Glass KPI Cards Skeleton */}
      <div className="admin-glass-kpi-grid">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="admin-glass-kpi-card" style={{ minHeight: '112px' }}>
            <div className="admin-kpi-header">
              <div className="skeleton" style={{ width: '90px', height: '14px', borderRadius: '4px' }} />
              <div className="skeleton" style={{ width: '28px', height: '28px', borderRadius: '8px' }} />
            </div>
            <div className="skeleton" style={{ width: '120px', height: '30px', margin: '14px 0 10px', borderRadius: '6px' }} />
            <div className="skeleton" style={{ width: '140px', height: '12px', borderRadius: '4px' }} />
          </div>
        ))}
      </div>

      {/* Mid Split Layout: Chart + Inventory Skeleton */}
      <div className="admin-split-grid">
        <section className="admin-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div className="skeleton" style={{ width: '220px', height: '18px', borderRadius: '4px' }} />
            <div className="skeleton" style={{ width: '70px', height: '14px', borderRadius: '4px' }} />
          </div>
          <div className="skeleton" style={{ width: '100%', height: '180px', borderRadius: '12px', marginBottom: '14px' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 8px' }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ width: '55px', height: '12px', borderRadius: '4px' }} />
            ))}
          </div>
        </section>

        <section className="admin-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div className="skeleton" style={{ width: '200px', height: '18px', borderRadius: '4px' }} />
            <div className="skeleton" style={{ width: '80px', height: '14px', borderRadius: '4px' }} />
          </div>
          <div className="admin-inventory-grid">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="admin-inventory-card" style={{ minHeight: '68px' }}>
                <div className="admin-inventory-top">
                  <div className="skeleton" style={{ width: '28px', height: '14px', borderRadius: '4px' }} />
                  <div className="skeleton" style={{ width: '65px', height: '12px', borderRadius: '4px' }} />
                </div>
                <div className="skeleton" style={{ width: '100%', height: '5px', margin: '8px 0 6px', borderRadius: '3px' }} />
                <div className="skeleton" style={{ width: '55px', height: '10px', borderRadius: '3px' }} />
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Bottom: Activity Table Skeleton */}
      <section className="admin-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div className="skeleton" style={{ width: '240px', height: '18px', borderRadius: '4px' }} />
          <div className="skeleton" style={{ width: '120px', height: '14px', borderRadius: '4px' }} />
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Thời gian</th>
                <th scope="col">Người thực hiện</th>
                <th scope="col">Hành động</th>
                <th scope="col">Đối tượng</th>
                <th scope="col">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td><div className="skeleton" style={{ width: '60px', height: '14px', borderRadius: '4px' }} /></td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div className="skeleton" style={{ width: '22px', height: '22px', borderRadius: '50%' }} />
                      <div className="skeleton" style={{ width: '110px', height: '14px', borderRadius: '4px' }} />
                    </div>
                  </td>
                  <td><div className="skeleton" style={{ width: '90px', height: '18px', borderRadius: '6px' }} /></td>
                  <td><div className="skeleton" style={{ width: '50px', height: '14px', borderRadius: '4px' }} /></td>
                  <td><div className="skeleton" style={{ width: '65px', height: '18px', borderRadius: '10px' }} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function AdminOverviewContent({ data }: { data: AdminOverviewData }) {
  const { kpi, inventory, monthlyTrend, recentActivities } = data;

  // Dynamic SVG Chart Coordinates calculated from monthlyTrend
  const maxDonations = Math.max(...monthlyTrend.map((m) => m.donations), 0);
  const chartWidth = 600;
  const chartHeight = 180;
  const padLeft = 40;
  const padRight = 40;
  const padTop = 30;
  const padBottom = 40;
  const plotWidth = chartWidth - padLeft - padRight;
  const plotHeight = chartHeight - padTop - padBottom;
  const baselineY = chartHeight - padBottom;

  const points = monthlyTrend.map((item, index) => {
    const x =
      monthlyTrend.length > 1
        ? padLeft + index * (plotWidth / (monthlyTrend.length - 1))
        : chartWidth / 2;
    const y =
      maxDonations > 0
        ? baselineY - (item.donations / maxDonations) * plotHeight
        : baselineY;
    return { x, y, item };
  });

  let curvePath = '';
  const firstPt = points[0];
  const lastPt = points[points.length - 1];

  if (firstPt) {
    curvePath = `M ${firstPt.x} ${firstPt.y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      if (p0 && p1) {
        const cpx1 = p0.x + (p1.x - p0.x) / 2;
        const cpy1 = p0.y;
        const cpx2 = p0.x + (p1.x - p0.x) / 2;
        const cpy2 = p1.y;
        curvePath += ` C ${cpx1} ${cpy1}, ${cpx2} ${cpy2}, ${p1.x} ${p1.y}`;
      }
    }
  }

  const areaPath =
    firstPt && lastPt && maxDonations > 0
      ? `${curvePath} L ${lastPt.x} ${baselineY} L ${firstPt.x} ${baselineY} Z`
      : '';

  return (
    <>
      {/* 5 Widescreen Glass KPI Cards */}
      <div className="admin-glass-kpi-grid">
        <div className="admin-glass-kpi-card">
          <div className="admin-kpi-header">
            <span className="admin-kpi-title">Tổng người hiến</span>
            <span className="admin-kpi-icon-badge" style={{ background: 'rgba(124, 98, 255, 0.14)', color: '#6c52ff' }} aria-hidden="true">
              <Users size={16} />
            </span>
          </div>
          <div className="admin-kpi-value">{kpi.totalDonors.toLocaleString('vi-VN')}</div>
          <div className="admin-kpi-trend admin-kpi-trend--up">
            <span>Đã ghi nhận trong cơ sở dữ liệu</span>
          </div>
        </div>

        <div className="admin-glass-kpi-card">
          <div className="admin-kpi-header">
            <span className="admin-kpi-title">Đơn vị máu thu</span>
            <span className="admin-kpi-icon-badge" style={{ background: 'rgba(67, 191, 177, 0.16)', color: '#0d9488' }} aria-hidden="true">
              <Droplets size={16} />
            </span>
          </div>
          <div className="admin-kpi-value">{kpi.totalDonations.toLocaleString('vi-VN')} túi</div>
          <div className="admin-kpi-trend admin-kpi-trend--up">
            <span>{(kpi.totalVolumeMl / 1000).toFixed(1)} L máu toàn phần</span>
          </div>
        </div>

        <div className="admin-glass-kpi-card">
          <div className="admin-kpi-header">
            <span className="admin-kpi-title">Lịch hẹn hôm nay</span>
            <span className="admin-kpi-icon-badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#059669' }} aria-hidden="true">
              <Calendar size={16} />
            </span>
          </div>
          <div className="admin-kpi-value">{kpi.todayAppointments} lượt</div>
          <div className="admin-kpi-trend" style={{ color: '#059669' }}>
            <span>● {kpi.todayCheckedIn} lượt đã hoàn thành</span>
          </div>
        </div>

        <div className="admin-glass-kpi-card">
          <div className="admin-kpi-header">
            <span className="admin-kpi-title">Tồn kho an toàn</span>
            <span className="admin-kpi-icon-badge" style={{ background: 'rgba(244, 63, 94, 0.14)', color: '#e11d48' }} aria-hidden="true">
              <AlertTriangle size={16} />
            </span>
          </div>
          <div className="admin-kpi-value">{kpi.safeInventoryDays} ngày</div>
          <div className="admin-kpi-trend" style={{ color: '#0d9488' }}>
            <span>Theo chuẩn dự trữ y tế</span>
          </div>
        </div>

        <div className="admin-glass-kpi-card">
          <div className="admin-kpi-header">
            <span className="admin-kpi-title">Trạng thái API</span>
            <span className="admin-kpi-icon-badge" style={{ background: 'rgba(124, 98, 255, 0.15)', color: '#6c52ff' }} aria-hidden="true">
              <Activity size={16} />
            </span>
          </div>
          <div className="admin-kpi-value" style={{ fontSize: '1.05rem', color: '#059669' }}>Trực tuyến (200 OK)</div>
          <div className="admin-kpi-trend admin-kpi-trend--purple">
            <span>● Database PostgreSQL</span>
          </div>
        </div>
      </div>

      {/* Mid Split Layout: Chart + Inventory Grid */}
      <div className="admin-split-grid">
        {/* Left: Monthly Trend Dynamic Chart */}
        <section className="admin-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Xu hướng tiếp nhận máu qua các tháng</h2>
            <div style={{ display: 'flex', gap: '12px', fontSize: '0.74rem' }}>
              <span style={{ color: '#6c52ff', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#6c52ff' }}></span>
                Số lượt hiến thực tế
              </span>
            </div>
          </div>

          <div className="admin-chart-wrap" aria-label="Biểu đồ xu hướng tiếp nhận máu">
            <svg viewBox="0 0 600 180" preserveAspectRatio="none">
              <defs>
                <linearGradient id="cyanArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7c62ff" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="#56d4c6" stopOpacity="0.02" />
                </linearGradient>
                <filter id="neonGlow">
                  <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Grid Lines */}
              <line x1="30" y1="30" x2="570" y2="30" stroke="rgba(148, 163, 184, 0.25)" strokeDasharray="3 3" />
              <line x1="30" y1="85" x2="570" y2="85" stroke="rgba(148, 163, 184, 0.25)" strokeDasharray="3 3" />
              <line x1="30" y1="140" x2="570" y2="140" stroke="rgba(148, 163, 184, 0.4)" />

              {/* Area Gradient (Computed from DB data) */}
              {areaPath && <path d={areaPath} fill="url(#cyanArea)" />}

              {/* Smooth Curve (Computed from DB data) */}
              {curvePath && (
                <path
                  d={curvePath}
                  fill="none"
                  stroke="#7c62ff"
                  strokeWidth="3"
                  filter="url(#neonGlow)"
                />
              )}

              {/* Real Data Points and Labels */}
              {points.map((pt, idx) => (
                <g key={idx}>
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r="4.5"
                    fill="#ffffff"
                    stroke="#6c52ff"
                    strokeWidth="2.5"
                  />
                  {pt.item.donations > 0 && (
                    <text
                      x={pt.x}
                      y={pt.y - 10}
                      textAnchor="middle"
                      fill="#5b3ff8"
                      fontSize="10"
                      fontWeight="700"
                    >
                      {pt.item.donations}
                    </text>
                  )}
                </g>
              ))}
            </svg>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#5a6478', fontSize: '0.74rem', padding: '0 8px' }}>
            {monthlyTrend.length > 0 ? (
              monthlyTrend.map((m) => (
                <span key={m.month} style={{ fontWeight: 600 }}>
                  {m.month}: {m.donations} lượt
                </span>
              ))
            ) : (
              <span style={{ textAlign: 'center', width: '100%', color: '#64748b' }}>
                Chưa có dữ liệu xu hướng theo tháng
              </span>
            )}
          </div>
        </section>

        {/* Right: Blood Inventory Stock Meters */}
        <section className="admin-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Tồn kho 8 nhóm máu</h2>
            <span style={{ fontSize: '0.72rem', color: '#0d9488', fontWeight: 700 }}>Thời gian thực</span>
          </div>

          <div className="admin-inventory-grid">
            {inventory.length === 0 ? (
              <p style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#64748b', padding: '24px 0' }}>
                Chưa có dữ liệu túi máu trong kho
              </p>
            ) : (
              inventory.map((item) => (
                <div key={item.bloodType} className="admin-inventory-card">
                  <div className="admin-inventory-top">
                    <span className="admin-inventory-type">{item.label}</span>
                    <span className="admin-inventory-volume">
                      {item.units} túi ({item.volumeMl} ml)
                    </span>
                  </div>
                  <div className="admin-inventory-track">
                    <div
                      className={`admin-inventory-fill admin-inventory-fill--${item.status}`}
                      style={{ width: `${Math.max(8, item.percentage)}%` }}
                    ></div>
                  </div>
                  <span
                    style={{
                      fontSize: '0.64rem',
                      fontWeight: 600,
                      color:
                        item.status === 'safe'
                          ? '#059669'
                          : item.status === 'warning'
                            ? '#d97706'
                            : item.status === 'critical'
                              ? '#e11d48'
                              : '#6c52ff',
                    }}
                  >
                    {item.status === 'safe'
                      ? 'Đạt chỉ tiêu'
                      : item.status === 'warning'
                        ? 'Cần dự trữ thêm'
                        : item.status === 'critical'
                          ? 'Kho thiếu hụt'
                          : 'Nhóm máu hiếm'}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Bottom: Live Activity Table */}
      <section className="admin-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Nhật ký hoạt động gần nhất</h2>
          <Link to="/admin/audit-logs" style={{ fontSize: '0.78rem', color: '#6c52ff', textDecoration: 'none', fontWeight: 700 }}>
            Xem toàn bộ nhật ký →
          </Link>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Thời gian</th>
                <th scope="col">Người thực hiện</th>
                <th scope="col">Hành động</th>
                <th scope="col">Đối tượng</th>
                <th scope="col">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {recentActivities.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: '#94a3b8', padding: '16px' }}>
                    Chưa có nhật ký hoạt động gần đây.
                  </td>
                </tr>
              ) : (
                recentActivities.map((act) => (
                  <tr key={act.id}>
                    <td>{new Date(act.createdAt).toLocaleTimeString('vi-VN')}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="admin-user-avatar" style={{ width: '22px', height: '22px', fontSize: '0.65rem' }}>
                          {act.actor.charAt(0).toUpperCase()}
                        </span>
                        <span>{act.actor}</span>
                      </div>
                    </td>
                    <td>
                      <code style={{ fontSize: '0.74rem' }}>{act.action}</code>
                    </td>
                    <td>{act.entityType}</td>
                    <td>
                      <span className="admin-badge admin-badge--success">Ghi nhận</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

export function AdminOverviewPage() {
  const repository = useAdminRepository();
  const query = useAdminQuery('overview', () => repository.overview());

  return (
    <AdminShell
      title="Tổng quan hệ thống"
      actions={
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <Link to="/admin/reports" className="btn btn--secondary">
            Báo cáo chi tiết
          </Link>
          <Link to="/admin/users" className="btn btn--primary">
            + Quản lý tài khoản
          </Link>
        </div>
      }
    >
      {query.loading && !query.data && <AdminOverviewSkeleton />}

      {!query.loading && !query.data && query.error ? (
        <div className="admin-card" style={{ padding: '24px', textAlign: 'center' }}>
          <p style={{ color: '#f87171', marginBottom: '12px' }}>
            Không thể tải dữ liệu tổng quan từ Backend.
          </p>
          <button type="button" className="btn btn--secondary" onClick={() => query.retry()}>
            Thử lại
          </button>
        </div>
      ) : null}

      {query.data ? (
        <AdminOverviewContent data={query.data} />
      ) : null}
    </AdminShell>
  );
}

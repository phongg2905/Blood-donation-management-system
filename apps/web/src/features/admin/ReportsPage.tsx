import { useSearchParams } from 'react-router-dom';
import { Droplets, FlaskConical, Package, Users } from 'lucide-react';
import { Button, FormField, Input } from '@/components/ui';
import { Feedback, QueryState } from '@/features/campaigns/components';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { AdminShell } from './components';
import { formatNumber } from './domain';
import { useAdminMutation, useAdminQuery } from './hooks';
import { useAdminRepository } from './repository';
import type { DonationReportQuery, ReportExport } from './types';

/** Saves the CSV the backend will stream once the export endpoint is agreed. */
function saveFile(file: ReportExport): void {
  if (typeof URL.createObjectURL !== 'function') return;
  const url = URL.createObjectURL(
    new Blob([file.content], { type: 'text/csv;charset=utf-8' }),
  );
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = file.filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

const toIso = (value: string | null, endOfDay = false): string | undefined =>
  value ? `${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z` : undefined;

export function ReportsPage() {
  const repository = useAdminRepository();
  const { hasPermission } = useAuth();
  const [params, setParams] = useSearchParams();

  const from = params.get('from');
  const to = params.get('to');
  const campaignId = params.get('campaignId');
  const query: DonationReportQuery = {
    ...(campaignId ? { campaignId } : {}),
    ...(toIso(from) ? { from: toIso(from)! } : {}),
    ...(toIso(to, true) ? { to: toIso(to, true)! } : {}),
  };

  // The campaign filter is built from the report itself — SYSTEM_ADMIN has no
  // `campaign.read`, so it must not depend on the campaign feature.
  const options = useAdminQuery('report-campaigns', () =>
    repository.donationReport({}),
  );
  const result = useAdminQuery(`report:${params}`, () =>
    repository.donationReport(query),
  );
  const mutation = useAdminMutation();

  const rows = result.data?.rows ?? [];
  const totals = result.data?.totals ?? {
    donations: 0,
    units: 0,
    volumeMl: 0,
    uniqueDonors: 0,
  };
  const campaignOptions = options.data?.rows ?? [];

  function change(name: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value);
    else next.delete(name);
    setParams(next);
  }

  function exportCsv() {
    void mutation.run(
      () => repository.exportDonationReport(query),
      saveFile,
      'Đã tạo tệp báo cáo.',
    );
  }

  return (
    <AdminShell
      title="Báo cáo hiến máu"
      actions={
        hasPermission('report.export') && (
          <Button
            variant="secondary"
            onClick={exportCsv}
            disabled={mutation.pending}
          >
            Xuất báo cáo
          </Button>
        )
      }
    >
      <form
        className="admin-filters"
        onSubmit={(event) => event.preventDefault()}
      >
        <FormField id="admin-report-campaign" label="Đợt hiến">
          <select
            className="input"
            id="admin-report-campaign"
            value={campaignId ?? ''}
            onChange={(event) => change('campaignId', event.target.value)}
          >
            <option value="">Tất cả đợt hiến</option>
            {campaignOptions.map((row) => (
              <option key={row.campaignId} value={row.campaignId}>
                {row.campaignName}
              </option>
            ))}
          </select>
        </FormField>
        <FormField id="admin-report-from" label="Từ ngày">
          <Input
            type="date"
            value={from ?? ''}
            onChange={(event) => change('from', event.target.value)}
          />
        </FormField>
        <FormField id="admin-report-to" label="Đến ngày">
          <Input
            type="date"
            min={from ?? undefined}
            value={to ?? ''}
            onChange={(event) => change('to', event.target.value)}
          />
        </FormField>
        <div className="admin-filters__action">
          <Button variant="secondary" onClick={() => setParams({})}>
            Xóa bộ lọc
          </Button>
          {hasPermission('report.export') && (
            <Button
              variant="secondary"
              isLoading={mutation.pending}
              onClick={exportCsv}
            >
              Xuất CSV
            </Button>
          )}
        </div>
      </form>

      <Feedback error={mutation.error} success={mutation.success} />
      <QueryState {...result} variant="table" columns={5} />
      {result.data && (
        <div className="admin-glass-kpi-grid">
          <div className="admin-glass-kpi-card">
            <div className="admin-kpi-header">
              <span className="admin-kpi-title">Tổng lượt hiến</span>
              <span className="admin-kpi-icon-badge" style={{ background: 'rgba(0, 240, 255, 0.15)', color: '#00f0ff' }} aria-hidden="true">
                <Droplets size={16} />
              </span>
            </div>
            <div className="admin-kpi-value">{formatNumber(totals.donations)}</div>
            <div className="admin-kpi-trend admin-kpi-trend--up">
              <span>● Trong kỳ báo cáo</span>
            </div>
          </div>
          <div className="admin-glass-kpi-card">
            <div className="admin-kpi-header">
              <span className="admin-kpi-title">Đơn vị máu</span>
              <span className="admin-kpi-icon-badge" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }} aria-hidden="true">
                <Package size={16} />
              </span>
            </div>
            <div className="admin-kpi-value">{formatNumber(totals.units)}</div>
            <div className="admin-kpi-trend admin-kpi-trend--up">
              <span>Túi máu thành phẩm</span>
            </div>
          </div>
          <div className="admin-glass-kpi-card">
            <div className="admin-kpi-header">
              <span className="admin-kpi-title">Tổng thể tích</span>
              <span className="admin-kpi-icon-badge" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc' }} aria-hidden="true">
                <FlaskConical size={16} />
              </span>
            </div>
            <div className="admin-kpi-value">{(totals.volumeMl / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} L</div>
            <div className="admin-kpi-trend admin-kpi-trend--purple">
              <span>{formatNumber(totals.volumeMl)} ml</span>
            </div>
          </div>
          <div className="admin-glass-kpi-card">
            <div className="admin-kpi-header">
              <span className="admin-kpi-title">Người hiến duy nhất</span>
              <span className="admin-kpi-icon-badge" style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80' }} aria-hidden="true">
                <Users size={16} />
              </span>
            </div>
            <div className="admin-kpi-value">{formatNumber(totals.uniqueDonors)}</div>
            <div className="admin-kpi-trend" style={{ color: '#4ade80' }}>
              <span>Tình nguyện viên</span>
            </div>
          </div>
        </div>
      )}
      {result.data &&
        (rows.length === 0 ? (
          <p className="admin-empty">
            Không có lượt hiến nào trong khoảng đã chọn.
          </p>
        ) : (
          <section className="admin-card">
            <div className="admin-table-wrap">
              <table className="admin-table">
                <caption className="visually-hidden">
                  Báo cáo hiến máu theo đợt
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Đợt hiến</th>
                    <th scope="col">Số lượt hiến</th>
                    <th scope="col">Đơn vị</th>
                    <th scope="col">Thể tích (ml)</th>
                    <th scope="col">Người hiến duy nhất</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.campaignId}>
                      <td>{row.campaignName}</td>
                      <td>{formatNumber(row.donations)}</td>
                      <td>{formatNumber(row.units)}</td>
                      <td>{formatNumber(row.volumeMl)}</td>
                      <td>{formatNumber(row.uniqueDonors)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row">Tổng</th>
                    <td>{formatNumber(totals.donations)}</td>
                    <td>{formatNumber(totals.units)}</td>
                    <td>{formatNumber(totals.volumeMl)}</td>
                    <td>{formatNumber(totals.uniqueDonors)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        ))}
      <p className="admin-muted">
        Tệp xuất dùng định dạng CSV do backend cung cấp; cơ chế tải tệp đang chờ
        BE xác nhận.
      </p>
    </AdminShell>
  );
}

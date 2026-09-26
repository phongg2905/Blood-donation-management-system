import { useSearchParams } from 'react-router-dom';
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
      lead="Tổng hợp số lượt hiến, đơn vị máu và thể tích theo đợt hiến và khoảng thời gian."
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
            {options.data?.rows.map((row) => (
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
          <Button variant="ghost" onClick={() => setParams({})}>
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
      <QueryState {...result} />
      {result.data &&
        (result.data.rows.length === 0 ? (
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
                  {result.data.rows.map((row) => (
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
                    <td>{formatNumber(result.data.totals.donations)}</td>
                    <td>{formatNumber(result.data.totals.units)}</td>
                    <td>{formatNumber(result.data.totals.volumeMl)}</td>
                    <td>{formatNumber(result.data.totals.uniqueDonors)}</td>
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

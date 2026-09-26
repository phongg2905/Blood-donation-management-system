import { useSearchParams } from 'react-router-dom';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '@blood/shared-types';
import { Button, FormField, Input } from '@/components/ui';
import { QueryState } from '@/features/campaigns/components';
import { AdminShell, AdminPagination } from './components';
import { auditActionLabel, formatDateTime } from './domain';
import { useAdminQuery } from './hooks';
import { useAdminRepository } from './repository';
import type { AuditLogQuery } from './types';

const PAGE_SIZE = 10;

const AUDIT_ACTION_CODES = Object.values(AUDIT_ACTIONS);
const AUDIT_ENTITY_CODES = Object.values(AUDIT_ENTITY_TYPES);

export function AuditLogsPage() {
  const repository = useAdminRepository();
  const [params, setParams] = useSearchParams();

  const requestedPage = Number(params.get('page'));
  const from = params.get('from');
  const to = params.get('to');
  const query: AuditLogQuery = {
    page:
      Number.isSafeInteger(requestedPage) && requestedPage > 0
        ? requestedPage
        : 1,
    limit: PAGE_SIZE,
    ...(params.get('actorId') ? { actorId: params.get('actorId')! } : {}),
    ...(params.get('action') ? { action: params.get('action')! } : {}),
    ...(params.get('entityType')
      ? { entityType: params.get('entityType')! }
      : {}),
    ...(params.get('entityId') ? { entityId: params.get('entityId')! } : {}),
    ...(from ? { from: `${from}T00:00:00.000Z` } : {}),
    ...(to ? { to: `${to}T23:59:59.999Z` } : {}),
  };

  const result = useAdminQuery(`audit:${params}`, () =>
    repository.auditLogs(query),
  );

  function change(name: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value);
    else next.delete(name);
    if (name !== 'page') next.delete('page');
    setParams(next);
  }

  return (
    <AdminShell
      title="Nhật ký hoạt động"
      lead="Tra cứu thao tác đã ghi nhận theo người thực hiện, hành động và đối tượng."
    >
      <form
        className="admin-filters"
        onSubmit={(event) => event.preventDefault()}
      >
        <FormField id="admin-audit-action" label="Hành động">
          <select
            className="input"
            id="admin-audit-action"
            value={params.get('action') ?? ''}
            onChange={(event) => change('action', event.target.value)}
          >
            <option value="">Tất cả hành động</option>
            {AUDIT_ACTION_CODES.map((action) => (
              <option key={action} value={action}>
                {auditActionLabel(action)}
              </option>
            ))}
          </select>
        </FormField>
        <FormField id="admin-audit-entity" label="Đối tượng">
          <select
            className="input"
            id="admin-audit-entity"
            value={params.get('entityType') ?? ''}
            onChange={(event) => change('entityType', event.target.value)}
          >
            <option value="">Tất cả đối tượng</option>
            {AUDIT_ENTITY_CODES.map((entity) => (
              <option key={entity} value={entity}>
                {entity}
              </option>
            ))}
          </select>
        </FormField>
        <FormField id="admin-audit-actor" label="Người thực hiện">
          <Input
            value={params.get('actorId') ?? ''}
            placeholder="Email"
            onChange={(event) => change('actorId', event.target.value)}
          />
        </FormField>
        <FormField id="admin-audit-from" label="Từ ngày">
          <Input
            type="date"
            value={from ?? ''}
            onChange={(event) => change('from', event.target.value)}
          />
        </FormField>
        <FormField id="admin-audit-to" label="Đến ngày">
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
        </div>
      </form>

      <QueryState {...result} />
      {result.data && (
        <section className="admin-card">
          {result.data.items.length === 0 ? (
            <p className="admin-empty">Không có bản ghi phù hợp.</p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <caption className="visually-hidden">
                  Nhật ký hoạt động hệ thống
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Thời điểm</th>
                    <th scope="col">Người thực hiện</th>
                    <th scope="col">Hành động</th>
                    <th scope="col">Đối tượng</th>
                    <th scope="col">Mã đối tượng</th>
                    <th scope="col">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {result.data.items.map((entry) => (
                    <tr key={entry.id}>
                      <td>{formatDateTime(entry.createdAt)}</td>
                      <td>{entry.actorEmail ?? '—'}</td>
                      <td>{auditActionLabel(entry.action)}</td>
                      <td>{entry.entityType}</td>
                      <td>
                        <code>{entry.entityId ?? '—'}</code>
                      </td>
                      <td>{entry.ipAddress ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <AdminPagination
            page={result.data.meta.page}
            totalPages={result.data.meta.totalPages}
            total={result.data.meta.total}
            onChange={(page) => change('page', String(page))}
          />
        </section>
      )}
    </AdminShell>
  );
}

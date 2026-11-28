import { useEffect, useRef, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  Database,
  Download,
  Eye,
  History,
  RotateCcw,
  ShieldCheck,
  Upload,
  Users,
} from 'lucide-react';
import { Button, FormField, Input } from '@/components/ui';
import { Feedback, QueryState } from '@/features/campaigns/components';
import { useAuth } from '@/features/auth/hooks/useAuth';
import {
  AdminBadge,
  AdminDialog,
  AdminPagination,
  AdminShell,
} from './components';
import { auditActionLabel, formatDateTime, formatNumber } from './domain';
import { useAdminMutation, useAdminQuery } from './hooks';
import { useAdminRepository } from './repository';
import { ApiNetworkError, ApiRequestError } from '@/services/api';
import type {
  BackupExportResult,
  BackupHistoryEntry,
  BackupInspectResult,
} from './types';

const PAGE_SIZE = 10;
const MAX_BACKUP_FILE_BYTES = 25 * 1024 * 1024;
const RESTORE_OPERATION_KEY = 'backup-restore-operation-id';

function rememberRestoreOperation(id: string | null) {
  try {
    if (id) sessionStorage.setItem(RESTORE_OPERATION_KEY, id);
    else sessionStorage.removeItem(RESTORE_OPERATION_KEY);
  } catch {
    // The current page can still poll when browser storage is unavailable.
  }
}

const TABLE_LABELS: Readonly<Record<string, string>> = {
  roles: 'Vai trò',
  permissions: 'Quyền hạn',
  rolePermissions: 'Ma trận phân quyền',
  systemSettings: 'Cấu hình hệ thống',
  users: 'Tài khoản',
  userRoles: 'Gán vai trò',
  donorProfiles: 'Hồ sơ người hiến',
  donationCampaigns: 'Đợt hiến máu',
  campaignTimeSlots: 'Khung giờ hiến',
  campaignStaff: 'Phân công nhân sự',
  registrations: 'Lượt đăng ký',
  healthDeclarations: 'Tờ khai y tế',
  checkIns: 'Lượt check-in',
  screenings: 'Khám sàng lọc',
  screeningTests: 'Xét nghiệm sàng lọc',
  donations: 'Lượt hiến máu',
  bloodBags: 'Túi máu',
  postDonationReactions: 'Phản ứng phụ',
  certificates: 'Chứng nhận',
  notifications: 'Thông báo',
  auditLogs: 'Nhật ký kiểm toán',
};

function formatBytes(value: unknown): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0)
    return null;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDuration(value: unknown): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0)
    return null;
  if (value < 1000) return `${Math.round(value)} ms`;
  return `${(value / 1000).toFixed(2)} s`;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readCountsRecord(value: unknown): Record<string, number> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const out: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      out[key] = raw;
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

function downloadJsonFile(result: BackupExportResult): void {
  if (typeof URL.createObjectURL !== 'function') return;
  const json = JSON.stringify(result.snapshot, null, 2);
  const url = URL.createObjectURL(
    new Blob([json], { type: 'application/json;charset=utf-8' }),
  );
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = result.filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function BackupsPage() {
  const repository = useAdminRepository();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('backup.manage');

  const [historyPage, setHistoryPage] = useState(1);
  const summaryQuery = useAdminQuery('backup-summary', () =>
    repository.backupSummary(),
  );
  const historyQuery = useAdminQuery(`backup-history:${historyPage}`, () =>
    repository.backupHistory(historyPage, PAGE_SIZE),
  );
  const mutation = useAdminMutation();

  const [includeCredentials, setIncludeCredentials] = useState(true);
  const [exportNote, setExportNote] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFilename, setSelectedFilename] = useState<string | null>(null);
  const [parsedSnapshot, setParsedSnapshot] = useState<unknown | null>(null);
  const [inspectResult, setInspectResult] =
    useState<BackupInspectResult | null>(null);
  const [fileReadError, setFileReadError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmKeyword, setConfirmKeyword] = useState('');
  const [restoreOperationId, setRestoreOperationId] = useState<string | null>(
    () => {
      try {
        return sessionStorage.getItem(RESTORE_OPERATION_KEY);
      } catch {
        return null;
      }
    },
  );
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreSuccess, setRestoreSuccess] = useState('');
  const [selectedHistory, setSelectedHistory] =
    useState<BackupHistoryEntry | null>(null);
  const [copiedChecksum, setCopiedChecksum] = useState(false);

  useEffect(() => {
    setCopiedChecksum(false);
    if (!selectedHistory) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !confirmOpen) {
        setSelectedHistory(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedHistory, confirmOpen]);
  const refreshAfterRestoreRef = useRef(() => {
    summaryQuery.retry();
    historyQuery.retry();
  });
  refreshAfterRestoreRef.current = () => {
    summaryQuery.retry();
    historyQuery.retry();
  };

  useEffect(() => {
    if (!restoreOperationId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = Date.now() + 120_000;

    const checkStatus = async () => {
      try {
        const operation = await repository.restoreStatus(restoreOperationId);
        if (cancelled) return;
        if (operation.status === 'succeeded') {
          rememberRestoreOperation(null);
          setRestoreOperationId(null);
          setRestoreSuccess('Đã khôi phục toàn bộ dữ liệu từ bản sao lưu.');
          setInspectResult(null);
          setParsedSnapshot(null);
          setSelectedFilename(null);
          if (fileInputRef.current) fileInputRef.current.value = '';
          refreshAfterRestoreRef.current();
          return;
        }
        if (operation.status === 'failed') {
          rememberRestoreOperation(null);
          setRestoreOperationId(null);
          setRestoreError(
            operation.error ??
              'Khôi phục thất bại. Dữ liệu hiện tại được giữ nguyên.',
          );
          return;
        }
      } catch (error) {
        if (cancelled) return;
        if (error instanceof ApiRequestError) {
          if (error.status === 404) {
            rememberRestoreOperation(null);
            setRestoreOperationId(null);
            setRestoreError(
              'Không tìm thấy trạng thái khôi phục. Hãy kiểm tra lịch sử trước khi thử lại.',
            );
            return;
          }
          if (error.status === 401 || error.status === 403) {
            setRestoreOperationId(null);
            setRestoreError(
              'Phiên đăng nhập đã hết hạn hoặc không còn quyền kiểm tra trạng thái khôi phục. Hãy đăng nhập lại bằng tài khoản đã khởi tạo khôi phục và có quyền quản trị để tiếp tục kiểm tra.',
            );
            return;
          }
        }
      }
      if (Date.now() >= deadline) {
        rememberRestoreOperation(null);
        setRestoreOperationId(null);
        setRestoreError(
          'Chưa xác định được kết quả khôi phục. Hãy kiểm tra lịch sử trước khi thử lại.',
        );
      } else {
        timer = setTimeout(() => void checkStatus(), 2_000);
      }
    };

    void checkStatus();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [restoreOperationId, repository]);

  function handleExport() {
    void mutation.run(
      () =>
        repository.exportBackup({
          includeCredentials,
          ...(exportNote.trim() ? { note: exportNote.trim() } : {}),
        }),
      (result) => {
        downloadJsonFile(result);
        setExportNote('');
        summaryQuery.retry();
        historyQuery.retry();
      },
      'Đã tạo và tải tệp sao lưu thành công.',
    );
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setFileReadError(null);
    setInspectResult(null);
    setParsedSnapshot(null);
    setRestoreError(null);
    if (!file) {
      setSelectedFilename(null);
      return;
    }
    setSelectedFilename(file.name);
    if (file.size > MAX_BACKUP_FILE_BYTES) {
      setFileReadError('Tệp sao lưu vượt quá giới hạn 25 MB của API.');
      return;
    }
    try {
      const text =
        typeof file.text === 'function'
          ? await file.text()
          : await new Response(file).text();
      const json = JSON.parse(text) as unknown;
      setParsedSnapshot(json);
      await mutation.run(
        () => repository.inspectBackup(json),
        (res) => {
          setInspectResult(res);
        },
        'Tệp sao lưu hợp lệ (SHA-256 khớp).',
      );
    } catch {
      setFileReadError('Không thể đọc tệp JSON sao lưu.');
    }
  }

  function handleConfirmRestore() {
    if (
      !parsedSnapshot ||
      restoreOperationId ||
      confirmKeyword.trim() !== 'RESTORE'
    )
      return;
    setRestoreError(null);
    setRestoreSuccess('');
    const operationId = crypto.randomUUID();
    void mutation.run(
      async () => {
        try {
          return await repository.restoreBackup(
            parsedSnapshot,
            operationId,
            selectedFilename,
          );
        } catch (error) {
          if (!(error instanceof ApiNetworkError)) throw error;
          return {
            id: operationId,
            status: 'running' as const,
            startedAt: new Date().toISOString(),
            finishedAt: null,
            result: null,
            error: null,
          };
        }
      },
      (operation) => {
        setConfirmOpen(false);
        setConfirmKeyword('');
        rememberRestoreOperation(operation.id);
        setRestoreOperationId(operation.id);
      },
      'Đang kiểm tra trạng thái khôi phục trên máy chủ.',
    );
  }

  const counts = summaryQuery.data?.counts;
  const totalSummaryRecords = counts
    ? counts.users +
      counts.campaigns +
      counts.registrations +
      counts.donations +
      counts.bloodBags
    : 0;

  return (
    <AdminShell title="Sao lưu & Khôi phục dữ liệu">
      <Feedback
        error={
          fileReadError
            ? { message: fileReadError }
            : restoreError
              ? { message: restoreError }
              : mutation.error
        }
        success={restoreError ? '' : restoreSuccess || mutation.success}
      />

      <QueryState {...summaryQuery} variant="table" columns={4} />

      {summaryQuery.data && counts && (
        <div className="admin-glass-kpi-grid">
          <div className="admin-glass-kpi-card">
            <div className="admin-kpi-header">
              <span className="admin-kpi-title">Tài khoản & Hồ sơ</span>
              <span
                className="admin-kpi-icon-badge"
                style={{
                  background: 'rgba(124, 98, 255, 0.14)',
                  color: '#6c52ff',
                }}
                aria-hidden="true"
              >
                <Users size={16} />
              </span>
            </div>
            <div className="admin-kpi-value">{formatNumber(counts.users)}</div>
            <div className="admin-kpi-trend admin-kpi-trend--purple">
              <span>{formatNumber(counts.donors)} hồ sơ người hiến</span>
            </div>
          </div>

          <div className="admin-glass-kpi-card">
            <div className="admin-kpi-header">
              <span className="admin-kpi-title">Dữ liệu nghiệp vụ</span>
              <span
                className="admin-kpi-icon-badge"
                style={{
                  background: 'rgba(67, 191, 177, 0.16)',
                  color: '#0d9488',
                }}
                aria-hidden="true"
              >
                <Database size={16} />
              </span>
            </div>
            <div className="admin-kpi-value">
              {formatNumber(totalSummaryRecords)}
            </div>
            <div className="admin-kpi-trend admin-kpi-trend--up">
              <span>
                {formatNumber(counts.campaigns)} đợt ·{' '}
                {formatNumber(counts.donations)} lượt ·{' '}
                {formatNumber(counts.bloodBags)} túi
              </span>
            </div>
          </div>

          <div className="admin-glass-kpi-card">
            <div className="admin-kpi-header">
              <span className="admin-kpi-title">Sao lưu gần nhất</span>
              <span
                className="admin-kpi-icon-badge"
                style={{
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#059669',
                }}
                aria-hidden="true"
              >
                <ShieldCheck size={16} />
              </span>
            </div>
            <div className="admin-kpi-value" style={{ fontSize: '1.15rem' }}>
              {formatDateTime(summaryQuery.data.lastBackupAt)}
            </div>
            <div className="admin-kpi-trend">
              <span>{summaryQuery.data.lastBackupBy ?? 'Chưa có'}</span>
            </div>
          </div>

          <div className="admin-glass-kpi-card">
            <div className="admin-kpi-header">
              <span className="admin-kpi-title">Khôi phục gần nhất</span>
              <span
                className="admin-kpi-icon-badge"
                style={{
                  background: 'rgba(245, 158, 11, 0.15)',
                  color: '#d97706',
                }}
                aria-hidden="true"
              >
                <History size={16} />
              </span>
            </div>
            <div className="admin-kpi-value" style={{ fontSize: '1.15rem' }}>
              {formatDateTime(summaryQuery.data.lastRestoreAt)}
            </div>
            <div className="admin-kpi-trend">
              <span>{summaryQuery.data.lastRestoreBy ?? 'Chưa có'}</span>
            </div>
          </div>
        </div>
      )}

      {canManage && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '14px',
          }}
        >
          {/* Export / Download Backup */}
          <section
            className="admin-card"
            aria-labelledby="backup-export-heading"
          >
            <h2 id="backup-export-heading">Tạo & tải bản sao lưu (.json)</h2>

            <div style={{ display: 'grid', gap: '12px', marginTop: '10px' }}>
              <FormField id="backup-mode" label="Chế độ xuất dữ liệu">
                <select
                  className="input"
                  id="backup-mode"
                  value={includeCredentials ? 'full' : 'sanitized'}
                  onChange={(e) =>
                    setIncludeCredentials(e.target.value === 'full')
                  }
                >
                  <option value="full">
                    Đầy đủ (kèm passwordHash — dùng để khôi phục)
                  </option>
                  <option value="sanitized">
                    Ẩn mật khẩu băm (chỉ lưu trữ / kiểm toán)
                  </option>
                </select>
              </FormField>

              <FormField id="backup-note" label="Ghi chú bản sao lưu">
                <Input
                  id="backup-note"
                  value={exportNote}
                  maxLength={300}
                  placeholder="VD: Trước kỳ bảo trì tháng 11..."
                  onChange={(e) => setExportNote(e.target.value)}
                />
              </FormField>

              <div
                className="admin-actions"
                style={{ justifyContent: 'flex-start' }}
              >
                <Button
                  type="button"
                  isLoading={mutation.pending}
                  disabled={Boolean(restoreOperationId)}
                  onClick={handleExport}
                >
                  <Download size={15} />
                  Tạo & tải bản sao lưu
                </Button>
              </div>
            </div>
          </section>

          {/* Inspect & Restore */}
          <section
            className="admin-card"
            aria-labelledby="backup-restore-heading"
          >
            <h2 id="backup-restore-heading">Kiểm tra & khôi phục từ tệp</h2>

            <div style={{ display: 'grid', gap: '12px', marginTop: '10px' }}>
              <FormField
                id="backup-file-input"
                label="Chọn tệp sao lưu (.json)"
              >
                <input
                  ref={fileInputRef}
                  id="backup-file-input"
                  type="file"
                  accept="application/json,.json"
                  className="input"
                  disabled={Boolean(restoreOperationId)}
                  onChange={(e) => void handleFileChange(e)}
                />
              </FormField>

              {selectedFilename && (
                <div
                  style={{
                    fontSize: '0.84rem',
                    color: 'var(--color-ink-700)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    flexWrap: 'wrap',
                  }}
                >
                  <Upload size={14} />
                  <span>{selectedFilename}</span>
                  {inspectResult && (
                    <AdminBadge tone="success">
                      <CheckCircle2 size={12} /> Hợp lệ ·{' '}
                      {formatNumber(inspectResult.totalRecords)} bản ghi
                    </AdminBadge>
                  )}
                </div>
              )}

              {inspectResult && (
                <div
                  style={{
                    background: 'var(--color-surface-sunken)',
                    borderRadius: '10px',
                    padding: '10px 12px',
                    fontSize: '0.82rem',
                    display: 'grid',
                    gap: '6px',
                  }}
                >
                  <div>
                    <strong>Thời điểm tạo:</strong>{' '}
                    {formatDateTime(inspectResult.createdAt)}
                  </div>
                  <div>
                    <strong>SHA-256:</strong>{' '}
                    <code>{inspectResult.checksumSha256.slice(0, 16)}…</code>
                  </div>
                  <div>
                    <strong>Khả năng khôi phục:</strong>{' '}
                    {inspectResult.restorable ? (
                      <AdminBadge tone="info">
                        Đầy đủ — Khôi phục được
                      </AdminBadge>
                    ) : (
                      <AdminBadge tone="warning">
                        Bản ẩn mật khẩu — Không hỗ trợ khôi phục
                      </AdminBadge>
                    )}
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns:
                        'repeat(auto-fill, minmax(150px, 1fr))',
                      gap: '4px 10px',
                      marginTop: '4px',
                    }}
                  >
                    {Object.entries(inspectResult.counts)
                      .filter(([, count]) => count > 0)
                      .map(([key, count]) => (
                        <div key={key}>
                          {TABLE_LABELS[key] ?? key}:{' '}
                          <strong>{formatNumber(count)}</strong>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              <div
                className="admin-actions"
                style={{ justifyContent: 'flex-start' }}
              >
                <Button
                  type="button"
                  variant="secondary"
                  disabled={
                    !inspectResult?.restorable ||
                    mutation.pending ||
                    Boolean(restoreOperationId)
                  }
                  onClick={() => {
                    setConfirmKeyword('');
                    setConfirmOpen(true);
                  }}
                >
                  <RotateCcw size={15} />
                  Khôi phục dữ liệu
                </Button>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* History Table */}
      <section className="admin-card" aria-labelledby="backup-history-heading">
        <h2 id="backup-history-heading">Lịch sử sao lưu & khôi phục</h2>
        <QueryState {...historyQuery} variant="table" columns={6} />
        {historyQuery.data &&
          (historyQuery.data.items.length === 0 ? (
            <p className="admin-empty">Chưa có lịch sử sao lưu nào.</p>
          ) : (
            <>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <caption className="visually-hidden">
                    Lịch sử sao lưu và khôi phục hệ thống
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Thời điểm</th>
                      <th scope="col">Thao tác</th>
                      <th scope="col">Người thực hiện</th>
                      <th scope="col">Tổng bản ghi</th>
                      <th scope="col">Checksum (SHA-256)</th>
                      <th scope="col">Chi tiết</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyQuery.data.items.map((item) => {
                      const total = Number(item.metadata?.totalRecords ?? 0);
                      const hash =
                        typeof item.metadata?.checksumSha256 === 'string'
                          ? item.metadata.checksumSha256
                          : null;
                      return (
                        <tr
                          key={item.id}
                          className="admin-table-row--clickable"
                          onClick={() => setSelectedHistory(item)}
                        >
                          <td>{formatDateTime(item.createdAt)}</td>
                          <td>
                            <AdminBadge
                              tone={
                                item.action === 'SYSTEM_BACKUP_RESTORED'
                                  ? 'warning'
                                  : 'success'
                              }
                            >
                              {auditActionLabel(item.action)}
                            </AdminBadge>
                          </td>
                          <td>{item.actorEmail ?? '—'}</td>
                          <td>{total ? formatNumber(total) : '—'}</td>
                          <td>
                            <code>{hash ? `${hash.slice(0, 16)}…` : '—'}</code>
                          </td>
                          <td>
                            <Button
                              type="button"
                              variant="ghost"
                              aria-label={`Xem chi tiết ${auditActionLabel(item.action)} ${formatDateTime(item.createdAt)}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                setSelectedHistory(item);
                              }}
                            >
                              <Eye size={14} />
                              Xem
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <AdminPagination
                page={historyQuery.data.meta.page}
                totalPages={historyQuery.data.meta.totalPages}
                total={historyQuery.data.meta.total}
                onChange={setHistoryPage}
              />
            </>
          ))}
      </section>

      {selectedHistory && (
        <BackupHistoryDetailModal
          entry={selectedHistory}
          copiedChecksum={copiedChecksum}
          onCopyChecksum={(hash) => {
            if (typeof navigator !== 'undefined' && navigator.clipboard) {
              void navigator.clipboard.writeText(hash).then(() => {
                setCopiedChecksum(true);
              });
            }
          }}
          onClose={() => setSelectedHistory(null)}
        />
      )}

      {confirmOpen && inspectResult && (
        <AdminDialog
          title="Xác nhận khôi phục dữ liệu"
          confirmLabel="Xác nhận khôi phục"
          confirmDisabled={confirmKeyword.trim() !== 'RESTORE'}
          pending={mutation.pending}
          error={mutation.error}
          onCancel={() => {
            setConfirmOpen(false);
            setConfirmKeyword('');
          }}
          onConfirm={handleConfirmRestore}
        >
          <p>
            Thao tác này sẽ thay thế toàn bộ dữ liệu hiện tại bằng{' '}
            <strong>{formatNumber(inspectResult.totalRecords)}</strong> bản ghi
            từ bản sao lưu tạo lúc{' '}
            <strong>{formatDateTime(inspectResult.createdAt)}</strong>.
          </p>
          <FormField
            id="restore-confirm-keyword"
            label='Nhập "RESTORE" để xác nhận'
            required
          >
            <Input
              id="restore-confirm-keyword"
              value={confirmKeyword}
              placeholder="RESTORE"
              onChange={(e) => setConfirmKeyword(e.target.value)}
            />
          </FormField>
        </AdminDialog>
      )}
    </AdminShell>
  );
}

function BackupHistoryDetailModal({
  entry,
  copiedChecksum,
  onCopyChecksum,
  onClose,
}: {
  entry: BackupHistoryEntry;
  copiedChecksum: boolean;
  onCopyChecksum: (hash: string) => void;
  onClose: () => void;
}) {
  const isRestore = entry.action === 'SYSTEM_BACKUP_RESTORED';
  const meta = entry.metadata ?? {};
  const filename = readString(meta.filename);
  const format = readString(meta.format);
  const version = typeof meta.version === 'number' ? meta.version : null;
  const checksum = readString(meta.checksumSha256);
  const note = readString(meta.note);
  const sizeText = formatBytes(meta.sizeBytes);
  const durationText = formatDuration(meta.durationMs);
  const totalRecords =
    typeof meta.totalRecords === 'number' ? meta.totalRecords : null;
  const previousTotalRecords =
    typeof meta.previousTotalRecords === 'number'
      ? meta.previousTotalRecords
      : null;
  const restoredFromCreatedAt = readString(meta.restoredFromCreatedAt);
  const snapshotCreatedBy =
    meta.snapshotCreatedBy &&
    typeof meta.snapshotCreatedBy === 'object' &&
    !Array.isArray(meta.snapshotCreatedBy)
      ? readString((meta.snapshotCreatedBy as { email?: unknown }).email)
      : null;
  const includeCredentials =
    typeof meta.includeCredentials === 'boolean'
      ? meta.includeCredentials
      : null;
  const counts = readCountsRecord(meta.counts);
  const previousCounts = readCountsRecord(meta.previousCounts);

  const tableKeys = Array.from(
    new Set([
      ...Object.keys(counts ?? {}),
      ...Object.keys(previousCounts ?? {}),
    ]),
  ).filter((key) => {
    const afterVal = counts?.[key] ?? 0;
    const beforeVal = previousCounts?.[key] ?? 0;
    return afterVal > 0 || beforeVal > 0;
  });

  const actorLabel = entry.actorName
    ? `${entry.actorName}${entry.actorEmail ? ` (${entry.actorEmail})` : ''}`
    : entry.actorEmail ?? '—';

  return (
    <div className="admin-dialog-backdrop" onClick={onClose}>
      <dialog
        open
        className="admin-dialog admin-user-detail-dialog"
        style={{ width: 'min(640px, 94vw)' }}
        aria-label={isRestore ? 'Chi tiết khôi phục' : 'Chi tiết sao lưu'}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="admin-user-detail-header">
          <div className="admin-user-detail-header__text">
            <h2>{isRestore ? 'Chi tiết khôi phục' : 'Chi tiết sao lưu'}</h2>
            <span className="admin-user-detail-email">
              {formatDateTime(entry.createdAt)}
            </span>
          </div>
          <div className="admin-user-detail-header__badges">
            <AdminBadge tone={isRestore ? 'warning' : 'success'}>
              {auditActionLabel(entry.action)}
            </AdminBadge>
            {includeCredentials !== null && (
              <AdminBadge tone={includeCredentials ? 'info' : 'neutral'}>
                {includeCredentials ? 'Đầy đủ xác thực' : 'Ẩn mật khẩu'}
              </AdminBadge>
            )}
          </div>
        </div>

        <div className="admin-user-detail-grid">
          <div className="admin-user-detail-item">
            <span className="admin-user-detail-label">Người thực hiện</span>
            <span className="admin-user-detail-value">{actorLabel}</span>
          </div>
          <div className="admin-user-detail-item">
            <span className="admin-user-detail-label">Địa chỉ IP</span>
            <span className="admin-user-detail-value">
              {entry.ipAddress ?? '—'}
            </span>
          </div>
          <div className="admin-user-detail-item">
            <span className="admin-user-detail-label">Tệp sao lưu</span>
            <span className="admin-user-detail-value">{filename ?? '—'}</span>
          </div>
          <div className="admin-user-detail-item">
            <span className="admin-user-detail-label">Định dạng</span>
            <span className="admin-user-detail-value">
              {format
                ? `${format}${version !== null ? ` · v${version}` : ''}`
                : '—'}
            </span>
          </div>
          <div className="admin-user-detail-item">
            <span className="admin-user-detail-label">Tổng bản ghi</span>
            <span className="admin-user-detail-value">
              {isRestore &&
              previousTotalRecords !== null &&
              totalRecords !== null
                ? `${formatNumber(previousTotalRecords)} → ${formatNumber(totalRecords)}`
                : totalRecords !== null
                  ? formatNumber(totalRecords)
                  : '—'}
            </span>
          </div>
          <div className="admin-user-detail-item">
            <span className="admin-user-detail-label">
              {sizeText ? 'Dung lượng / Thời gian' : 'Thời gian xử lý'}
            </span>
            <span className="admin-user-detail-value">
              {[sizeText, durationText].filter(Boolean).join(' · ') || '—'}
            </span>
          </div>

          {isRestore && (
            <>
              <div className="admin-user-detail-item">
                <span className="admin-user-detail-label">
                  Mốc tạo bản sao lưu
                </span>
                <span className="admin-user-detail-value">
                  {formatDateTime(restoredFromCreatedAt)}
                </span>
              </div>
              <div className="admin-user-detail-item">
                <span className="admin-user-detail-label">
                  Người tạo bản sao lưu
                </span>
                <span className="admin-user-detail-value">
                  {snapshotCreatedBy ?? '—'}
                </span>
              </div>
            </>
          )}

          {note && (
            <div className="admin-user-detail-item admin-user-detail-item--full">
              <span className="admin-user-detail-label">Ghi chú</span>
              <span className="admin-user-detail-value">{note}</span>
            </div>
          )}

          {entry.userAgent && (
            <div className="admin-user-detail-item admin-user-detail-item--full">
              <span className="admin-user-detail-label">Trình duyệt / Thiết bị</span>
              <span
                className="admin-user-detail-value"
                style={{ fontSize: '0.78rem', wordBreak: 'break-word' }}
              >
                {entry.userAgent}
              </span>
            </div>
          )}

          <div className="admin-user-detail-item admin-user-detail-item--full">
            <span className="admin-user-detail-label">Checksum SHA-256</span>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
                flexWrap: 'wrap',
              }}
            >
              <code style={{ fontSize: '0.78rem', wordBreak: 'break-all' }}>
                {checksum ?? '—'}
              </code>
              {checksum && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onCopyChecksum(checksum)}
                >
                  {copiedChecksum ? <Check size={14} /> : <Copy size={14} />}
                  {copiedChecksum ? 'Đã chép' : 'Sao chép'}
                </Button>
              )}
            </div>
          </div>
        </div>

        {tableKeys.length > 0 && (
          <div className="admin-table-wrap" style={{ maxHeight: '220px' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">Bảng dữ liệu</th>
                  {isRestore && previousCounts ? (
                    <>
                      <th scope="col">Trước</th>
                      <th scope="col">Sau</th>
                    </>
                  ) : (
                    <th scope="col">Số bản ghi</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {tableKeys.map((key) => (
                  <tr key={key}>
                    <td>{TABLE_LABELS[key] ?? key}</td>
                    {isRestore && previousCounts ? (
                      <>
                        <td>{formatNumber(previousCounts[key] ?? 0)}</td>
                        <td>{formatNumber(counts?.[key] ?? 0)}</td>
                      </>
                    ) : (
                      <td>{formatNumber(counts?.[key] ?? 0)}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="admin-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Đóng
          </Button>
        </div>
      </dialog>
    </div>
  );
}

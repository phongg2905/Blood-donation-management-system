import { useState } from 'react';
import { Button, Input } from '@/components/ui';
import { Feedback, QueryState } from '@/features/campaigns/components';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { AdminShell } from './components';
import {
  formatDateTime,
  validateSettingValue,
  type SettingValueType,
} from './domain';
import { useAdminMutation, useAdminQuery } from './hooks';
import { useAdminRepository } from './repository';
import type { SystemSetting } from './types';

const asValueType = (value: string | null): SettingValueType => {
  const upper = (value ?? 'STRING').toUpperCase();
  return upper === 'NUMBER' || upper === 'BOOLEAN' || upper === 'JSON'
    ? upper
    : 'STRING';
};

export function SettingsPage() {
  const repository = useAdminRepository();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('setting.manage');

  const result = useAdminQuery('settings', () => repository.settings());
  const mutation = useAdminMutation();

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>();

  function startEdit(setting: SystemSetting) {
    setEditingKey(setting.key);
    setDraft(setting.value);
    setFieldError(undefined);
  }

  function save(setting: SystemSetting) {
    const error = validateSettingValue(draft, asValueType(setting.valueType));
    setFieldError(error ?? undefined);
    if (error) return;
    void mutation.run(
      () => repository.updateSetting(setting.key, { value: draft.trim() }),
      () => {
        setEditingKey(null);
        result.retry();
      },
      `Đã lưu cấu hình "${setting.key}".`,
    );
  }

  const grouped = (result.data ?? []).reduce<Record<string, SystemSetting[]>>(
    (groups, setting) => {
      const key = setting.category ?? 'khác';
      (groups[key] ??= []).push(setting);
      return groups;
    },
    {},
  );

  return (
    <AdminShell
      title="Cấu hình hệ thống"
      lead="Các khoá cấu hình dùng chung. Chỉ thay đổi giá trị, không thêm khoá mới."
    >
      <Feedback error={mutation.error} success={mutation.success} />
      <QueryState {...result} />
      {result.data && result.data.length === 0 && (
        <p className="admin-empty">Chưa có cấu hình nào.</p>
      )}
      {Object.entries(grouped).map(([category, settings]) => (
        <section className="admin-card" key={category}>
          <h2>{category}</h2>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <caption className="visually-hidden">
                Cấu hình nhóm {category}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Khoá</th>
                  <th scope="col">Giá trị</th>
                  <th scope="col">Kiểu</th>
                  <th scope="col">Mô tả</th>
                  <th scope="col">Cập nhật</th>
                  <th scope="col">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {settings.map((setting) => {
                  const editing = editingKey === setting.key;
                  return (
                    <tr key={setting.key}>
                      <td>
                        <code>{setting.key}</code>
                      </td>
                      <td>
                        {editing ? (
                          <>
                            <label
                              className="visually-hidden"
                              htmlFor={`setting-${setting.key}`}
                            >
                              Giá trị của {setting.key}
                            </label>
                            <Input
                              id={`setting-${setting.key}`}
                              value={draft}
                              aria-invalid={fieldError ? 'true' : undefined}
                              onChange={(event) => setDraft(event.target.value)}
                            />
                            {fieldError && (
                              <p className="field__error">{fieldError}</p>
                            )}
                          </>
                        ) : (
                          <code>{setting.value}</code>
                        )}
                      </td>
                      <td>{setting.valueType ?? '—'}</td>
                      <td>{setting.description ?? '—'}</td>
                      <td>{formatDateTime(setting.updatedAt)}</td>
                      <td>
                        {canManage ? (
                          <div className="admin-row-actions">
                            {editing ? (
                              <>
                                <Button
                                  isLoading={mutation.pending}
                                  onClick={() => save(setting)}
                                >
                                  Lưu
                                </Button>
                                <Button
                                  variant="ghost"
                                  disabled={mutation.pending}
                                  onClick={() => setEditingKey(null)}
                                >
                                  Hủy
                                </Button>
                              </>
                            ) : (
                              <Button
                                variant="secondary"
                                onClick={() => startEdit(setting)}
                              >
                                Sửa
                              </Button>
                            )}
                          </div>
                        ) : (
                          <span className="admin-muted">Chỉ đọc</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      {!canManage && (
        <p className="admin-muted">
          Bạn không có quyền <code>setting.manage</code> nên chỉ xem được cấu
          hình.
        </p>
      )}
    </AdminShell>
  );
}

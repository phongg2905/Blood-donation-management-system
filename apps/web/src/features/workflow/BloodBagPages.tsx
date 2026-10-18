import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { MapPin, Clock, X } from 'lucide-react';
import { BLOOD_BAG_STATUSES, type BloodBagStatus } from '@blood/shared-types';
import { Button, FormField, Input } from '@/components/ui';
import { ConfirmDialog, Feedback, QueryState } from '@/features/campaigns/components';
import { useCampaignRepository } from '@/features/campaigns/repository';
import { useCampaignQuery } from '@/features/campaigns/hooks';
import {
  BLOOD_BAG_STATUS_LABELS,
  BLOOD_GROUP_OPTIONS,
  OPERATIONAL_STATUS_SHORT_LABELS,
  RH_OPTIONS,
  formatBloodTypeDisplay,
  formatDate,
  formatDateTime,
  getOperationalWindow,
  parseBackendBloodType,
  sortCampaignsForOperationalStation,
  toBackendBloodType,
  type FieldErrors,
} from './domain';
import { useWorkflowMutation, useWorkflowQuery } from './hooks';
import { useWorkflowRepository } from './repository';
import {
  DetailList,
  StationCompactHeader,
  StatusPill,
  WorkflowPagination,
  WorkflowShell,
  type PillTone,
} from './components';
import type { BloodBag, BloodGroup, RhFactor, ScreeningQueueItem } from './types';

const bagTone: Record<BloodBagStatus, PillTone> = {
  CREATED: 'neutral',
  COLLECTED: 'info',
  PENDING_TEST: 'warning',
  TESTED: 'info',
  ACCEPTED: 'success',
  REJECTED: 'danger',
  DISCARDED: 'neutral',
};

/** Quick-action modal for collecting blood bag directly from the screening queue */
function QuickCollectModal({
  item,
  campaignId,
  campaignName,
  onClose,
  onCollected,
}: {
  item: ScreeningQueueItem;
  campaignId?: string;
  campaignName?: string;
  onClose: () => void;
  onCollected: () => void;
}) {
  const workflow = useWorkflowRepository();
  const mutation = useWorkflowMutation();
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [code, setCode] = useState('');
  const [volume, setVolume] = useState(() => String(item.screening.indicatedVolumeMl || 350));
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    }
    return () => {
      if (dialog?.open) {
        if (typeof dialog.close === 'function') dialog.close();
        else dialog.removeAttribute('open');
      }
    };
  }, []);

  function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (!code.trim()) {
      setError('Vui lòng quét hoặc nhập mã barcode túi máu.');
      return;
    }
    const volNum = Number(volume);
    if (!Number.isInteger(volNum) || volNum <= 0) {
      setError('Thể tích máu phải là số nguyên dương (ml).');
      return;
    }
    setError(null);

    const bloodGroup = item.screening.bloodGroup ?? null;
    const rh = item.screening.rh ?? null;

    void mutation.run(
      () =>
        workflow.createBloodBag({
          registrationId: item.registration.id,
          code: code.trim(),
          donorName: item.registration.donorName,
          volumeMl: volNum,
          bloodGroup,
          bloodType: toBackendBloodType(bloodGroup, rh),
          campaignId: campaignId ?? item.registration.campaignId,
          campaignName: campaignName ?? item.registration.campaignName,
          status: 'COLLECTED',
          notes: notes.trim() || undefined,
        }),
      () => {
        onCollected();
      },
      'Đã ghi nhận túi máu thành công.',
    );
  }

  return (
    <dialog
      ref={dialogRef}
      className="campaign-dialog"
      aria-labelledby="quick-collect-title"
      tabIndex={-1}
      onCancel={(e) => {
        e.preventDefault();
        if (!mutation.pending) onClose();
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <h2 id="quick-collect-title" style={{ margin: 0, fontSize: '1.25rem' }}>
          Gán mã túi máu thu nhận
        </h2>
        <Button variant="secondary" onClick={onClose} style={{ padding: '4px 10px', fontSize: '0.85rem' }} aria-label="Đóng">
          <X size={16} />
        </Button>
      </div>

      <div
        style={{
          background: 'var(--color-surface-sunken, #f8fafc)',
          padding: '12px 14px',
          borderRadius: '10px',
          marginBottom: '16px',
          border: '1px solid var(--color-border)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--color-ink-900)' }}>
              {item.registration.donorName}
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--color-ink-600)' }}>
              Mã ĐK: <strong>{item.registration.code}</strong> {item.registration.donorIdentity && `· CCCD: ${item.registration.donorIdentity}`}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span
              className="tag-blood-group"
              style={
                !item.screening.bloodGroup
                  ? { background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }
                  : undefined
              }
            >
              {item.screening.bloodGroup
                ? `Nhóm ${item.screening.bloodGroup} ${item.screening.rh === 'POSITIVE' ? '(Rh+)' : item.screening.rh === 'NEGATIVE' ? '(Rh−)' : ''}`
                : 'Chờ xét nghiệm Lab'}
            </span>
            <span
              style={{
                fontSize: '0.8rem',
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: '6px',
                background: '#ecfdf5',
                color: '#065f46',
                border: '1px solid #a7f3d0',
              }}
            >
              Chỉ định: {item.screening.indicatedVolumeMl ?? 350} ml
            </span>
          </div>
        </div>
      </div>

      <form className="workflow-form workflow-form--inline" onSubmit={handleSave}>
        <FormField id="collect-bag-code" label="Mã barcode túi máu" error={error ?? undefined} required>
          <Input
            autoFocus
            value={code}
            placeholder="Quét hoặc gõ mã túi (VD: BAG-00123...)"
            onChange={(e) => {
              setCode(e.target.value);
              if (error) setError(null);
            }}
          />
        </FormField>

        <FormField
          id="collect-bag-vol"
          label="Thể tích thu nhận (ml)"
          labelAction={
            <span style={{ color: '#059669', fontWeight: 600, fontSize: '0.85rem' }}>
              Y lệnh bác sĩ: {item.screening.indicatedVolumeMl ?? 350} ml
            </span>
          }
          required
        >
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <Input
              type="number"
              min="1"
              value={volume}
              onChange={(e) => setVolume(e.target.value)}
              style={{ maxWidth: '140px' }}
            />
            <div style={{ display: 'flex', gap: '6px' }}>
              {(['250', '350', '450'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  className={`btn btn--sm ${volume === v ? 'btn--primary' : 'btn--secondary'}`}
                  onClick={() => setVolume(v)}
                >
                  {v} ml
                </button>
              ))}
            </div>
          </div>
        </FormField>

        <FormField id="collect-bag-notes" label="Ghi chú (nếu có)">
          <Input
            value={notes}
            placeholder="VD: Người hiến thể trạng tốt, lấy thuận lợi..."
            onChange={(e) => setNotes(e.target.value)}
          />
        </FormField>

        <Feedback error={mutation.error} />

        <div className="campaign-actions" style={{ marginTop: '18px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <Button type="button" variant="secondary" disabled={mutation.pending} onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" isLoading={mutation.pending}>
            Xác nhận lưu túi máu
          </Button>
        </div>
      </form>
    </dialog>
  );
}

/** Modal dialog for viewing detailed blood bag information */
function BloodBagDetailModal({
  bag,
  onClose,
  onEdit,
  onDelete,
}: {
  bag: BloodBag;
  onClose: () => void;
  onEdit: (bag: BloodBag) => void;
  onDelete: (bag: BloodBag) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    }
    return () => {
      if (dialog?.open) {
        if (typeof dialog.close === 'function') dialog.close();
        else dialog.removeAttribute('open');
      }
    };
  }, []);

  const bloodGroupDisplay = formatBloodTypeDisplay(bag.bloodType, bag.bloodGroup);
  const isLabPending = bag.status === 'COLLECTED' || bag.status === 'PENDING_TEST';

  return (
    <dialog
      ref={dialogRef}
      className="campaign-dialog blood-bag-detail-dialog"
      aria-labelledby="blood-bag-detail-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="blood-bag-detail-header">
        <div>
          <span className="blood-bag-detail-eyebrow">Hồ sơ lưu trữ túi máu</span>
          <h2 id="blood-bag-detail-title" className="blood-bag-detail-code">
            {bag.code}
          </h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <StatusPill tone={bagTone[bag.status]}>
            {BLOOD_BAG_STATUS_LABELS[bag.status]}
          </StatusPill>
          <Button variant="secondary" onClick={onClose} style={{ padding: '4px 8px' }} aria-label="Đóng cửa sổ chi tiết">
            <X size={16} />
          </Button>
        </div>
      </div>

      <div className="blood-bag-detail-grid">
        {/* Card 1: Thông số nhóm máu & thể tích */}
        <div className="blood-bag-detail-card">
          <div className="blood-bag-detail-card__title">Thông số máu</div>
          <div className="blood-bag-detail-blood-highlight">
            <div className="blood-badge-large">
              {bloodGroupDisplay}
            </div>
            <div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-ink-900)' }}>
                {bag.volumeMl} ml
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-ink-500)' }}>
                {isLabPending ? 'Chờ kiểm nghiệm Lab' : 'Đã khẳng định'}
              </div>
            </div>
          </div>
          <div className="blood-bag-detail-field">
            <span className="blood-bag-detail-field__label">Thời điểm tiếp nhận:</span>
            <span className="blood-bag-detail-field__value">{formatDateTime(bag.receivedAt)}</span>
          </div>
        </div>

        {/* Card 2: Thông tin nguồn gốc & Người hiến */}
        <div className="blood-bag-detail-card">
          <div className="blood-bag-detail-card__title">Người hiến & Đợt hiến</div>
          <div className="blood-bag-detail-field">
            <span className="blood-bag-detail-field__label">Họ tên người hiến:</span>
            <span className="blood-bag-detail-field__value" style={{ fontWeight: 700, color: 'var(--color-primary-800)' }}>
              {bag.donorName}
            </span>
          </div>
          <div className="blood-bag-detail-field">
            <span className="blood-bag-detail-field__label">Đợt hiến máu:</span>
            <span className="blood-bag-detail-field__value">{bag.campaignName || '—'}</span>
          </div>
          <div className="blood-bag-detail-field">
            <span className="blood-bag-detail-field__label">Giấy chứng nhận:</span>
            <span className="blood-bag-detail-field__value">
              {bag.certificateCode ? (
                <span className="badge badge--success" style={{ fontSize: '0.75rem' }}>
                  {bag.certificateCode}
                </span>
              ) : (
                <span style={{ color: 'var(--color-ink-400)', fontSize: '0.85rem' }}>Chưa cấp / Đang xử lý</span>
              )}
            </span>
          </div>
        </div>

        {/* Card 3: Vị trí kho & Bảo quản */}
        <div className="blood-bag-detail-card" style={{ gridColumn: 'span 2' }}>
          <div className="blood-bag-detail-card__title">Quản lý kho & Bảo quản</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            <div className="blood-bag-detail-field">
              <span className="blood-bag-detail-field__label">Vị trí lưu kho:</span>
              <span className="blood-bag-detail-field__value" style={{ fontWeight: 600 }}>
                {bag.storageLocation ? `📍 ${bag.storageLocation}` : '— Chưa xếp vị trí —'}
              </span>
            </div>
            <div className="blood-bag-detail-field">
              <span className="blood-bag-detail-field__label">Điều kiện lưu trữ:</span>
              <span className="blood-bag-detail-field__value">2°C – 6°C (Kho lạnh huyết học)</span>
            </div>
            {bag.notes && (
              <div className="blood-bag-detail-field" style={{ gridColumn: '1 / -1' }}>
                <span className="blood-bag-detail-field__label">Ghi chú:</span>
                <span className="blood-bag-detail-field__value" style={{ fontStyle: 'italic' }}>{bag.notes}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="blood-bag-detail-actions">
        {isLabPending && (
          <Button
            type="button"
            variant="primary"
            style={{ background: '#0284c7', borderColor: '#0284c7' }}
            onClick={() => {
              onClose();
              onEdit(bag);
            }}
          >
            Nhập kết quả xét nghiệm Lab
          </Button>
        )}
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            onClose();
            onEdit(bag);
          }}
        >
          Sửa thông tin
        </Button>
        <Button
          type="button"
          variant="danger"
          onClick={() => {
            onClose();
            onDelete(bag);
          }}
        >
          Xóa túi máu
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={onClose}
          style={{ marginLeft: 'auto' }}
        >
          Đóng
        </Button>
      </div>
    </dialog>
  );
}

/** Modal dialog for editing blood bag information */
function EditBloodBagModal({
  bag,
  onClose,
  onSaved,
}: {
  bag: BloodBag;
  onClose: () => void;
  onSaved: () => void;
}) {
  const workflow = useWorkflowRepository();
  const mutation = useWorkflowMutation();
  const dialogRef = useRef<HTMLDialogElement>(null);

  const initialBlood = parseBackendBloodType(bag.bloodType);
  const [code, setCode] = useState(bag.code);
  const [donorName, setDonorName] = useState(bag.donorName);
  const [volumeMl, setVolumeMl] = useState(String(bag.volumeMl));
  const [bloodGroup, setBloodGroup] = useState<BloodGroup | ''>(
    initialBlood.bloodGroup || (bag.bloodGroup as BloodGroup) || '',
  );
  const [rh, setRh] = useState<RhFactor | ''>(initialBlood.rh || '');
  const [status, setStatus] = useState<BloodBagStatus>(bag.status);
  const [storageLocation, setStorageLocation] = useState(bag.storageLocation ?? '');
  const [syncDonorProfile, setSyncDonorProfile] = useState(true);
  const [notes, setNotes] = useState(bag.notes ?? '');
  const [errors, setErrors] = useState<FieldErrors>({});

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    }
    return () => {
      if (dialog?.open) {
        if (typeof dialog.close === 'function') dialog.close();
        else dialog.removeAttribute('open');
      }
    };
  }, []);

  function handleSave(event: React.FormEvent) {
    event.preventDefault();
    const nextErrors: FieldErrors = {};
    if (!code.trim()) nextErrors.code = 'Mã túi máu không được để trống.';
    const volNum = Number(volumeMl);
    if (!Number.isInteger(volNum) || volNum <= 0) {
      nextErrors.volumeMl = 'Thể tích phải là số nguyên lớn hơn 0.';
    }

    // Require confirmed blood group and Rh if status is TESTED or ACCEPTED
    if (status === 'TESTED' || status === 'ACCEPTED') {
      if (!bloodGroup) {
        nextErrors.bloodGroup = 'Bắt buộc chọn nhóm máu ABO khẳng định.';
      }
      if (!rh) {
        nextErrors.rh = 'Bắt buộc chọn yếu tố Rh khẳng định.';
      }
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const finalBloodType = toBackendBloodType(bloodGroup, rh);

    void mutation.run(
      () =>
        workflow.updateBloodBag(bag.id, {
          code: code.trim(),
          donorName: donorName.trim() || undefined,
          volumeMl: volNum,
          bloodGroup: bloodGroup || null,
          bloodType: finalBloodType,
          status,
          storageLocation: storageLocation.trim() || undefined,
          syncDonorProfile,
          notes: notes.trim() || undefined,
        }),
      () => {
        onSaved();
      },
      status === 'ACCEPTED' || status === 'TESTED'
        ? 'Đã cập nhật kết quả xét nghiệm túi máu & đồng bộ hồ sơ thành công.'
        : 'Đã cập nhật thông tin túi máu thành công.',
    );
  }

  return (
    <dialog
      ref={dialogRef}
      className="campaign-dialog"
      aria-labelledby="edit-bag-title"
      tabIndex={-1}
      onCancel={(event) => {
        event.preventDefault();
        if (!mutation.pending) onClose();
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <h2 id="edit-bag-title" style={{ margin: 0, fontSize: '1.25rem' }}>
          Chỉnh sửa túi máu
        </h2>
        <Button variant="secondary" onClick={onClose} style={{ padding: '4px 10px', fontSize: '0.85rem' }} aria-label="Đóng">
          <X size={16} />
        </Button>
      </div>

      <form className="workflow-form workflow-form--inline" onSubmit={handleSave}>
        <FormField id="edit-bag-code" label="Mã túi máu" error={errors.code} required>
          <Input
            value={code}
            placeholder="VD: BAG-00042"
            onChange={(e) => setCode(e.target.value)}
          />
        </FormField>

        <FormField id="edit-bag-donor" label="Người hiến">
          <Input
            value={donorName}
            placeholder="Họ tên người hiến"
            onChange={(e) => setDonorName(e.target.value)}
          />
        </FormField>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <FormField id="edit-bag-volume" label="Thể tích (ml)" error={errors.volumeMl} required>
            <Input
              type="number"
              min="1"
              value={volumeMl}
              onChange={(e) => setVolumeMl(e.target.value)}
            />
          </FormField>

          <FormField id="edit-bag-status" label="Trạng thái túi máu" required>
            <select
              className="input"
              id="edit-bag-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as BloodBagStatus)}
            >
              {BLOOD_BAG_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {BLOOD_BAG_STATUS_LABELS[st]}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        {/* Lab Testing & Blood Group Confirmation Section */}
        <div
          style={{
            background: status === 'TESTED' || status === 'ACCEPTED' ? '#f0fdf4' : 'var(--color-surface-sunken, #f8fafc)',
            border: `1px solid ${status === 'TESTED' || status === 'ACCEPTED' ? '#bbf7d0' : 'var(--color-border)'}`,
            borderRadius: '10px',
            padding: '14px',
            margin: '4px 0 14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '6px' }}>
            <span style={{ fontWeight: 700, color: status === 'TESTED' || status === 'ACCEPTED' ? '#166534' : 'var(--color-ink-900)', fontSize: '0.92rem' }}>
              🔬 Kết quả xét nghiệm khẳng định (Phòng Lab)
            </span>
            {(status === 'TESTED' || status === 'ACCEPTED') && (
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '999px',
                  background: '#dcfce7',
                  color: '#15803d',
                }}
              >
                Bắt buộc nhập nhóm máu
              </span>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <FormField id="edit-bag-group" label="Nhóm máu ABO" error={errors.bloodGroup} required={status === 'TESTED' || status === 'ACCEPTED'}>
              <select
                className="input"
                id="edit-bag-group"
                value={bloodGroup}
                onChange={(e) => {
                  setBloodGroup(e.target.value as BloodGroup | '');
                  if (errors.bloodGroup) {
                    setErrors((prev) => {
                      const next = { ...prev };
                      delete next.bloodGroup;
                      return next;
                    });
                  }
                }}
              >
                <option value="">-- Chưa xác định --</option>
                {BLOOD_GROUP_OPTIONS.map((g) => (
                  <option key={g} value={g}>
                    Nhóm {g}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField id="edit-bag-rh" label="Yếu tố Rh" error={errors.rh} required={status === 'TESTED' || status === 'ACCEPTED'}>
              <select
                className="input"
                id="edit-bag-rh"
                value={rh}
                onChange={(e) => {
                  setRh(e.target.value as RhFactor | '');
                  if (errors.rh) {
                    setErrors((prev) => {
                      const next = { ...prev };
                      delete next.rh;
                      return next;
                    });
                  }
                }}
              >
                <option value="">-- Chưa xác định --</option>
                {RH_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r === 'POSITIVE' ? 'Dương tính (Rh+)' : 'Âm tính (Rh−)'}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          <div style={{ marginTop: '12px' }}>
            <FormField id="edit-bag-storage" label="Vị trí lưu kho lạnh (tùy chọn)">
              <Input
                value={storageLocation}
                placeholder="VD: Tủ mát bảo quản A1 - Khay 02, Kho lạnh B..."
                onChange={(e) => setStorageLocation(e.target.value)}
              />
            </FormField>
          </div>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginTop: '12px',
              cursor: 'pointer',
              fontSize: '0.84rem',
              color: 'var(--color-ink-800)',
              fontWeight: 500,
            }}
          >
            <input
              type="checkbox"
              checked={syncDonorProfile}
              onChange={(e) => setSyncDonorProfile(e.target.checked)}
              style={{ width: '16px', height: '16px' }}
            />
            <span>Đồng bộ vĩnh viễn vào Hồ sơ người hiến & Gửi thông báo kết quả cho người hiến</span>
          </label>
        </div>

        <FormField id="edit-bag-notes" label="Ghi chú">
          <Input
            value={notes}
            placeholder="Ghi chú theo dõi (nếu có)"
            onChange={(e) => setNotes(e.target.value)}
          />
        </FormField>

        <Feedback error={mutation.error} />

        <div className="campaign-actions" style={{ marginTop: '16px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <Button
            type="button"
            variant="secondary"
            disabled={mutation.pending}
            onClick={onClose}
          >
            Hủy
          </Button>
          <Button type="submit" isLoading={mutation.pending}>
            Lưu thay đổi
          </Button>
        </div>
      </form>
    </dialog>
  );
}

export function BloodBagsPage() {
  const { campaignId } = useParams<{ campaignId?: string }>();
  const workflow = useWorkflowRepository();
  const campaignRepo = useCampaignRepository();

  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'queue' | 'collected'>('queue');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'UPCOMING' | 'CLOSED'>('ALL');
  const [viewMode, setViewMode] = useState<'campaigns' | 'all'>('campaigns');

  const [collectingItem, setCollectingItem] = useState<ScreeningQueueItem | null>(null);
  const [editingBag, setEditingBag] = useState<BloodBag | null>(null);
  const [deletingBag, setDeletingBag] = useState<BloodBag | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<{ message: string } | null>(null);

  const campaignQuery = useCampaignQuery(
    `blood-bag-campaign:${campaignId}`,
    () => campaignRepo.detail(campaignId!),
    Boolean(campaignId),
  );

  const campaignsListQuery = useCampaignQuery(
    'blood-bag-campaigns-list',
    () => campaignRepo.list({ page: 1, limit: 30, sort: 'desc' }),
    !campaignId,
  );

  const bags = useWorkflowQuery(
    `blood-bags:${campaignId ?? 'all'}`,
    () => workflow.bloodBags(campaignId),
  );

  // Ready to collect queue (screened eligible donors)
  const readyQueue = useWorkflowQuery(
    `eligible-blood-bags:${campaignId ?? 'all'}`,
    () => workflow.eligibleForBag(campaignId),
    Boolean(campaignId),
  );

  const operationalWindow = campaignQuery.data
    ? getOperationalWindow(campaignQuery.data.startsAt, campaignQuery.data.endsAt)
    : null;

  // Filter state for "all blood bags" view
  const [processTab, setProcessTab] = useState<'ALL' | 'WAITING_TEST' | 'READY' | 'DISCARDED'>('ALL');
  const [bloodGroupFilter, setBloodGroupFilter] = useState<'ALL' | 'O' | 'A' | 'B' | 'AB' | 'RH_NEG'>('ALL');

  // Filtered collected bags with process tab & blood group filters
  const filteredBags = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('vi');
    return (bags.data ?? []).filter((bag) => {
      // 1. Process / Status tab filter
      if (processTab === 'WAITING_TEST') {
        if (bag.status !== 'COLLECTED' && bag.status !== 'PENDING_TEST') return false;
      } else if (processTab === 'READY') {
        if (bag.status !== 'ACCEPTED' && bag.status !== 'TESTED') return false;
      } else if (processTab === 'DISCARDED') {
        if (bag.status !== 'REJECTED' && bag.status !== 'DISCARDED') return false;
      }

      // 2. Blood group filter
      if (bloodGroupFilter === 'RH_NEG') {
        if (!bag.bloodType?.includes('_NEGATIVE') && !bag.bloodType?.includes('−')) return false;
      } else if (bloodGroupFilter !== 'ALL') {
        const parsed = parseBackendBloodType(bag.bloodType);
        const group = parsed.bloodGroup || bag.bloodGroup;
        if (group !== bloodGroupFilter) return false;
      }

      // 3. Search text
      if (!term) return true;
      return `${bag.code} ${bag.donorName} ${bag.campaignName ?? ''} ${bag.storageLocation ?? ''}`
        .toLocaleLowerCase('vi')
        .includes(term);
    });
  }, [bags.data, search, processTab, bloodGroupFilter]);

  // Volume & production stats
  const stats = useMemo(() => {
    const list = bags.data ?? [];
    const totalVolumeMl = list.reduce((sum, b) => sum + (b.volumeMl || 0), 0);
    const c250 = list.filter((b) => b.volumeMl === 250).length;
    const c350 = list.filter((b) => b.volumeMl === 350).length;
    const c450 = list.filter((b) => b.volumeMl === 450).length;
    return {
      count: list.length,
      volumeLitres: (totalVolumeMl / 1000).toFixed(1),
      c250,
      c350,
      c450,
    };
  }, [bags.data]);

  // Inventory-specific stats for "Xem toàn bộ túi máu"
  const inventoryStats = useMemo(() => {
    const list = bags.data ?? [];
    const totalCount = list.length;
    const totalVolumeMl = list.reduce((sum, b) => sum + (b.volumeMl || 0), 0);
    const waitingTestCount = list.filter(
      (b) => b.status === 'COLLECTED' || b.status === 'PENDING_TEST',
    ).length;
    const readyCount = list.filter(
      (b) => b.status === 'ACCEPTED' || b.status === 'TESTED',
    ).length;
    const discardedCount = list.filter(
      (b) => b.status === 'REJECTED' || b.status === 'DISCARDED',
    ).length;
    const rhNegCount = list.filter(
      (b) => b.bloodType?.includes('_NEGATIVE') || b.bloodType?.includes('−'),
    ).length;

    return {
      totalCount,
      volumeLitres: (totalVolumeMl / 1000).toFixed(1),
      waitingTestCount,
      readyCount,
      discardedCount,
      rhNegCount,
    };
  }, [bags.data]);

  // Pagination & detail view for blood bag lists
  const PAGE_SIZE = 6;
  const [viewingBag, setViewingBag] = useState<BloodBag | null>(null);
  const [allPage, setAllPage] = useState(1);
  const [collectedPage, setCollectedPage] = useState(1);

  useEffect(() => {
    setAllPage(1);
  }, [search, processTab, bloodGroupFilter]);

  useEffect(() => {
    setCollectedPage(1);
  }, [search]);

  const allTotalPages = Math.max(1, Math.ceil(filteredBags.length / PAGE_SIZE));
  const safeAllPage = Math.min(Math.max(1, allPage), allTotalPages);
  const paginatedAllBags = useMemo(() => {
    return filteredBags.slice((safeAllPage - 1) * PAGE_SIZE, safeAllPage * PAGE_SIZE);
  }, [filteredBags, safeAllPage]);

  const collectedTotalPages = Math.max(1, Math.ceil(filteredBags.length / PAGE_SIZE));
  const safeCollectedPage = Math.min(Math.max(1, collectedPage), collectedTotalPages);
  const paginatedCollectedBags = useMemo(() => {
    return filteredBags.slice((safeCollectedPage - 1) * PAGE_SIZE, safeCollectedPage * PAGE_SIZE);
  }, [filteredBags, safeCollectedPage]);

  async function handleConfirmDelete() {
    if (!deletingBag) return;
    try {
      setIsDeleting(true);
      setDeleteError(null);
      await workflow.deleteBloodBag(deletingBag.id);
      setDeletingBag(null);
      bags.retry();
      if (campaignId) readyQueue.retry();
    } catch (err) {
      setDeleteError({
        message: err instanceof Error ? err.message : 'Không thể xóa túi máu.',
      });
    } finally {
      setIsDeleting(false);
    }
  }

  // 1. If accessed without a campaignId (via /clinic/blood-bags):
  if (!campaignId) {
    const rawCampaignsWithWindow = (campaignsListQuery.data?.items ?? []).map((campaign) => ({
      campaign,
      window: getOperationalWindow(campaign.startsAt, campaign.endsAt),
      bagCount: (bags.data ?? []).filter(
        (b) => b.campaignId === campaign.id || b.campaignName === campaign.name,
      ).length,
    }));

    const campaignsWithWindow = sortCampaignsForOperationalStation(rawCampaignsWithWindow);

    const totalCount = campaignsWithWindow.length;
    const activeCount = campaignsWithWindow.filter((c) => c.window.status === 'ACTIVE').length;
    const upcomingCount = campaignsWithWindow.filter((c) => c.window.status === 'UPCOMING').length;
    const closedCount = campaignsWithWindow.filter((c) => c.window.status === 'CLOSED').length;

    const filteredCampaigns = campaignsWithWindow.filter((c) => {
      if (statusFilter === 'ALL') return true;
      return c.window.status === statusFilter;
    });

    return (
      <WorkflowShell
        title="Túi máu đã tiếp nhận"
        lead={
          viewMode === 'campaigns'
            ? 'Vui lòng chọn đợt hiến máu để quản lý và gắn mã túi máu theo đợt.'
            : 'Danh sách túi máu ghi nhận từ các đợt hiến trên toàn hệ thống.'
        }
        actions={
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Button
              variant="secondary"
              onClick={() => setViewMode((prev) => (prev === 'campaigns' ? 'all' : 'campaigns'))}
            >
              {viewMode === 'campaigns' ? 'Xem toàn bộ túi máu' : 'Xem theo đợt hiến'}
            </Button>
            <Link className="btn btn--primary" to="/clinic/blood-bags/new">
              Thêm túi máu
            </Link>
          </div>
        }
      >

        {viewingBag && (
          <BloodBagDetailModal
            bag={viewingBag}
            onClose={() => setViewingBag(null)}
            onEdit={(b) => setEditingBag(b)}
            onDelete={(b) => setDeletingBag(b)}
          />
        )}

        {editingBag && (
          <EditBloodBagModal
            bag={editingBag}
            onClose={() => setEditingBag(null)}
            onSaved={() => {
              setEditingBag(null);
              bags.retry();
            }}
          />
        )}

        {deletingBag && (
          <ConfirmDialog
            title="Xác nhận xóa túi máu"
            label="Xác nhận xóa"
            pending={isDeleting}
            error={deleteError}
            onCancel={() => {
              setDeletingBag(null);
              setDeleteError(null);
            }}
            onConfirm={handleConfirmDelete}
          >
            <p>
              Bạn có chắc chắn muốn xóa túi máu <strong>{deletingBag.code}</strong> (Người hiến: <strong>{deletingBag.donorName}</strong>) khỏi hệ thống không?
            </p>
          </ConfirmDialog>
        )}

        {viewMode === 'all' ? (
          <>
            {/* Smart Search, Status Process Tabs & Blood Group Chips */}
            <div className="smart-search-container" style={{ marginBottom: '10px' }}>
              <div className="smart-search-input-wrap">
                <input
                  className="smart-search-input"
                  type="search"
                  value={search}
                  placeholder="Tìm theo mã barcode túi, người hiến, đợt hiến hoặc vị trí kho..."
                  onChange={(e) => setSearch(e.target.value)}
                />
                {search && (
                  <button className="smart-search-clear" type="button" onClick={() => setSearch('')} aria-label="Xóa tìm kiếm">
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Status Process Tabs */}
              <div className="smart-filter-chips" role="tablist" style={{ marginTop: '8px' }}>
                <button
                  type="button"
                  className={`smart-filter-chip ${processTab === 'ALL' ? 'smart-filter-chip--active' : ''}`}
                  onClick={() => setProcessTab('ALL')}
                >
                  Tất cả <span className="smart-filter-chip__count">{bags.loading ? '…' : inventoryStats.totalCount}</span>
                </button>
                <button
                  type="button"
                  className={`smart-filter-chip ${processTab === 'WAITING_TEST' ? 'smart-filter-chip--active' : ''}`}
                  onClick={() => setProcessTab('WAITING_TEST')}
                >
                  Chờ xét nghiệm Lab <span className="smart-filter-chip__count">{bags.loading ? '…' : inventoryStats.waitingTestCount}</span>
                </button>
                <button
                  type="button"
                  className={`smart-filter-chip ${processTab === 'READY' ? 'smart-filter-chip--active' : ''}`}
                  onClick={() => setProcessTab('READY')}
                >
                  Đạt chuẩn / Lưu kho <span className="smart-filter-chip__count">{bags.loading ? '…' : inventoryStats.readyCount}</span>
                </button>
                <button
                  type="button"
                  className={`smart-filter-chip ${processTab === 'DISCARDED' ? 'smart-filter-chip--active' : ''}`}
                  onClick={() => setProcessTab('DISCARDED')}
                >
                  Không đạt / Hủy <span className="smart-filter-chip__count">{bags.loading ? '…' : inventoryStats.discardedCount}</span>
                </button>
              </div>

              {/* Quick Blood Group Filter Chips */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', marginTop: '8px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-ink-600)' }}>
                  Nhóm máu:
                </span>
                {(
                  [
                    { id: 'ALL', label: 'Tất cả' },
                    { id: 'O', label: 'Nhóm O' },
                    { id: 'A', label: 'Nhóm A' },
                    { id: 'B', label: 'Nhóm B' },
                    { id: 'AB', label: 'Nhóm AB' },
                    { id: 'RH_NEG', label: 'Rh− (Hiếm)' },
                  ] as const
                ).map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    className={`btn btn--sm ${bloodGroupFilter === chip.id ? 'btn--primary' : 'btn--secondary'}`}
                    style={{ fontSize: '0.78rem', padding: '2px 8px', borderRadius: '6px' }}
                    onClick={() => setBloodGroupFilter(chip.id)}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>

            <QueryState {...bags} variant="table" columns={5} count={4} />
            {!bags.loading && bags.data && filteredBags.length === 0 && (
              <p className="workflow-empty">Không có túi máu nào phù hợp với bộ lọc.</p>
            )}
            {!bags.loading && filteredBags.length > 0 && (
              <>
                <div className="workflow-table-wrap">
                  <table className="workflow-table">
                    <caption className="visually-hidden">Danh sách túi máu đã tiếp nhận</caption>
                    <thead>
                      <tr>
                        <th scope="col">Mã túi</th>
                        <th scope="col">Người hiến</th>
                        <th scope="col">Nhóm máu & Thể tích</th>
                        <th scope="col">Trạng thái</th>
                        <th scope="col" style={{ textAlign: 'right' }}>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedAllBags.map((bag) => (
                        <tr
                          key={bag.id}
                          onClick={() => setViewingBag(bag)}
                          title="Bấm để xem hồ sơ chi tiết túi máu"
                        >
                          <th scope="row">
                            <button
                              type="button"
                              className="btn-link-detail"
                              onClick={(e) => {
                                e.stopPropagation();
                                setViewingBag(bag);
                              }}
                            >
                              <strong>{bag.code}</strong>
                            </button>
                          </th>
                          <td>{bag.donorName}</td>
                          <td>
                            <span className="tag-blood-group" style={{ marginRight: '6px' }}>
                              {formatBloodTypeDisplay(bag.bloodType, bag.bloodGroup)}
                            </span>
                            <span style={{ fontWeight: 600 }}>{bag.volumeMl} ml</span>
                          </td>
                          <td>
                            <StatusPill tone={bagTone[bag.status]}>
                              {BLOOD_BAG_STATUS_LABELS[bag.status]}
                            </StatusPill>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              className="btn btn--primary btn--sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setViewingBag(bag);
                              }}
                            >
                              Chi tiết
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              <WorkflowPagination
                page={safeAllPage}
                totalPages={allTotalPages}
                total={filteredBags.length}
                pageSize={PAGE_SIZE}
                onChange={setAllPage}
                itemLabel="túi máu"
              />
            </>
          )}
          </>
        ) : (
          <>
            <QueryState {...campaignsListQuery} variant="station-grid" count={3} />

            {!campaignsListQuery.loading && campaignsListQuery.data && (
              <>
                <div className="station-filter-bar" role="tablist" aria-label="Bộ lọc trạng thái đợt hiến">
                  <button
                    type="button"
                    className={`station-filter-btn ${statusFilter === 'ALL' ? 'station-filter-btn--active' : ''}`}
                    onClick={() => setStatusFilter('ALL')}
                  >
                    Tất cả <span className="station-filter-btn__count">{totalCount}</span>
                  </button>
                  <button
                    type="button"
                    className={`station-filter-btn ${statusFilter === 'ACTIVE' ? 'station-filter-btn--active' : ''}`}
                    onClick={() => setStatusFilter('ACTIVE')}
                  >
                    Mở <span className="station-filter-btn__count">{activeCount}</span>
                  </button>
                  <button
                    type="button"
                    className={`station-filter-btn ${statusFilter === 'UPCOMING' ? 'station-filter-btn--active' : ''}`}
                    onClick={() => setStatusFilter('UPCOMING')}
                  >
                    Chưa mở <span className="station-filter-btn__count">{upcomingCount}</span>
                  </button>
                  <button
                    type="button"
                    className={`station-filter-btn ${statusFilter === 'CLOSED' ? 'station-filter-btn--active' : ''}`}
                    onClick={() => setStatusFilter('CLOSED')}
                  >
                    Đã đóng <span className="station-filter-btn__count">{closedCount}</span>
                  </button>
                </div>

                {filteredCampaigns.length === 0 && (
                  <p className="workflow-empty">Không có đợt hiến nào trong trạng thái này.</p>
                )}

                <ul className="station-campaign-grid">
              {filteredCampaigns.map(({ campaign, window, bagCount }) => (
                <li
                  key={campaign.id}
                  className={`station-campaign-card ${window.status === 'ACTIVE' ? 'station-campaign-card--active' : ''}`}
                >
                  <div className="station-campaign-card__header">
                    <div>
                      <h3 className="station-campaign-card__title">
                        {campaign.name}
                      </h3>
                      <p className="station-campaign-card__meta" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <MapPin size={14} style={{ flexShrink: 0, opacity: 0.75 }} />
                        <span>{campaign.location}</span>
                      </p>
                      <p className="station-campaign-card__meta" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={14} style={{ flexShrink: 0, opacity: 0.75 }} />
                        <span>
                          {formatDate(campaign.startsAt)} (
                          {new Date(campaign.startsAt).toLocaleTimeString('vi-VN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}{' '}
                          –{' '}
                          {new Date(campaign.endsAt).toLocaleTimeString('vi-VN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                          )
                        </span>
                      </p>
                    </div>
                    <div className="station-campaign-card__metrics">
                      <span
                        className="station-metric-pill"
                        title={
                          window.status === 'ACTIVE'
                            ? 'Đang mở thu nhận máu'
                            : window.status === 'UPCOMING'
                              ? 'Chưa mở'
                              : 'Đã đóng'
                        }
                      >
                        <span
                          className={`station-signal-dot station-signal-dot--${
                            window.status === 'ACTIVE'
                              ? 'active'
                              : window.status === 'UPCOMING'
                                ? 'upcoming'
                                : 'closed'
                          }`}
                          aria-hidden="true"
                        />
                        <span>{bagCount} túi máu</span>
                      </span>
                    </div>
                  </div>

                  <div className="station-campaign-card__footer">
                    <span className="station-campaign-card__lead">
                      {window.status === 'ACTIVE'
                        ? 'Đợt hiến đang mở thu nhận máu.'
                        : window.status === 'UPCOMING'
                          ? 'Đợt hiến chuẩn bị diễn ra.'
                          : 'Đợt hiến đã kết thúc.'}
                    </span>
                    <Link
                      className="btn btn--primary"
                      to={`/campaigns/${campaign.id}/blood-bags`}
                    >
                      Vào quản lý túi máu
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
              </>
            )}
          </>
        )}
      </WorkflowShell>
    );
  }

  // 2. Direct campaign station route: /campaigns/:campaignId/blood-bags
  return (
    <WorkflowShell
      title="Túi máu đã tiếp nhận"
      back="/clinic/blood-bags"
      backLabel="← Chọn đợt hiến khác"
      actions={
        <Link
          className="btn btn--primary"
          to={`/campaigns/${campaignId}/blood-bags/new`}
        >
          Thêm túi máu
        </Link>
      }
    >
      {/* Compact Station Workstation Header */}
      {campaignQuery.data && (
        <StationCompactHeader
          campaign={campaignQuery.data}
          activeStation="bloodbags"
          operationalWindow={operationalWindow}
        />
      )}

      {/* KPI Production Summary Banner */}
      <section className="workflow-kpi-bar" aria-label="Thống kê sản lượng túi máu">
        <div className="workflow-kpi-card workflow-kpi-card--primary">
          <span className="workflow-kpi-card__label">Tổng túi thu được</span>
          <span className="workflow-kpi-card__value">
            {bags.loading ? '—' : stats.count} <span className="workflow-kpi-card__unit">túi</span>
          </span>
        </div>
        <div className="workflow-kpi-card workflow-kpi-card--success">
          <span className="workflow-kpi-card__label">Tổng thể tích</span>
          <span className="workflow-kpi-card__value">
            {bags.loading ? '—' : stats.volumeLitres} <span className="workflow-kpi-card__unit">Lít</span>
          </span>
        </div>
        <div className="workflow-kpi-card">
          <span className="workflow-kpi-card__label">Cơ cấu thể tích</span>
          <div style={{ display: 'flex', gap: '8px', fontSize: '0.88rem', fontWeight: 600, color: 'var(--color-ink-800)', marginTop: '4px' }}>
            <span>250ml: <strong>{bags.loading ? '—' : stats.c250}</strong></span>
            <span>·</span>
            <span>350ml: <strong>{bags.loading ? '—' : stats.c350}</strong></span>
            <span>·</span>
            <span>450ml: <strong>{bags.loading ? '—' : stats.c450}</strong></span>
          </div>
        </div>
        <div className="workflow-kpi-card workflow-kpi-card--info">
          <span className="workflow-kpi-card__label">Chờ lấy máu</span>
          <span className="workflow-kpi-card__value">
            {readyQueue.loading ? '—' : (readyQueue.data?.length ?? 0)} <span className="workflow-kpi-card__unit">người</span>
          </span>
        </div>
      </section>

      {/* Tab Switcher */}
      <div className="blood-tab-bar" role="tablist">
        <button
          type="button"
          className={`blood-tab-btn ${activeTab === 'queue' ? 'blood-tab-btn--active' : ''}`}
          onClick={() => setActiveTab('queue')}
        >
          Chờ lấy máu{' '}
          <span className="blood-tab-btn__badge">
            {readyQueue.loading ? '…' : (readyQueue.data?.length ?? 0)}
          </span>
        </button>
        <button
          type="button"
          className={`blood-tab-btn ${activeTab === 'collected' ? 'blood-tab-btn--active' : ''}`}
          onClick={() => setActiveTab('collected')}
        >
          Túi máu đã thu nhận{' '}
          <span className="blood-tab-btn__badge">
            {bags.loading ? '…' : stats.count}
          </span>
        </button>
      </div>

      {/* Tab 1: Queue of donors ready to collect */}
      {activeTab === 'queue' && (
        <section aria-labelledby="ready-queue-heading">
          <h2 id="ready-queue-heading" className="visually-hidden">
            Danh sách người hiến đã đủ điều kiện chờ lấy máu
          </h2>
          <QueryState {...readyQueue} variant="ready-queue" count={3} />

          {!readyQueue.loading && readyQueue.data && readyQueue.data.length === 0 && (
            <div className="workflow-card" style={{ textAlign: 'center', padding: '32px 20px' }}>
              <h3 style={{ margin: '0 0 6px' }}>Chưa có người hiến nào chờ lấy máu</h3>
              <p className="workflow-muted" style={{ maxWidth: '44ch', margin: '0 auto 16px' }}>
                Người hiến sau khi được bác sĩ kết luận <strong>Đủ điều kiện</strong> tại bàn Sàng lọc sẽ tự động xuất hiện tại đây để lấy máu và gán mã túi.
              </p>
              <Link className="btn btn--secondary" to={`/campaigns/${campaignId}/screening`}>
                Xem hàng chờ sàng lọc
              </Link>
            </div>
          )}

          {!readyQueue.loading && readyQueue.data && readyQueue.data.length > 0 && (
            <div style={{ display: 'grid', gap: '12px' }}>
              {readyQueue.data.map((item) => (
                <div key={item.registration.id} className="ready-donor-card">
                  <div className="ready-donor-card__info">
                    <h3 className="ready-donor-card__name">
                      {item.registration.donorName}
                      <span className="tag-blood-group">
                        {item.screening.bloodGroup
                          ? `Nhóm ${item.screening.bloodGroup} ${item.screening.rh === 'POSITIVE' ? '(Rh+)' : item.screening.rh === 'NEGATIVE' ? '(Rh−)' : ''}`
                          : 'Nhóm máu: Chưa rõ'}
                      </span>
                    </h3>
                    <div className="ready-donor-card__tags">
                      <span>Mã: <strong>{item.registration.code}</strong></span>
                      <span>·</span>
                      <span>CCCD: {item.registration.donorIdentity ?? '—'}</span>
                      <span>·</span>
                      <span>
                        Chỉ định: <strong style={{ color: 'var(--color-primary-700, #059669)' }}>{item.screening.indicatedVolumeMl ?? 350} ml</strong>
                      </span>
                      <span>·</span>
                      <span>Kết luận sàng lọc: <strong>Đủ điều kiện</strong></span>
                    </div>
                  </div>
                  <div>
                    <Button
                      onClick={() => setCollectingItem(item)}
                    >
                      Lấy máu & Gán túi
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Tab 2: Collected blood bags table */}
      {activeTab === 'collected' && (
        <section aria-labelledby="collected-bags-heading">
          <h2 id="collected-bags-heading" className="visually-hidden">
            Danh sách túi máu đã thu nhận tại đợt hiến
          </h2>

          <div className="smart-search-container" style={{ marginBottom: '14px' }}>
            <div className="smart-search-input-wrap">
              <input
                className="smart-search-input"
                type="search"
                value={search}
                placeholder="Tìm theo mã túi hoặc tên người hiến..."
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button className="smart-search-clear" type="button" onClick={() => setSearch('')} aria-label="Xóa tìm kiếm">
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          <QueryState {...bags} variant="table" columns={5} count={4} />
          {!bags.loading && bags.data && filteredBags.length === 0 && (
            <p className="workflow-empty">Đợt này chưa có túi máu nào phù hợp với bộ lọc.</p>
          )}

          {!bags.loading && filteredBags.length > 0 && (
            <>
              <div className="workflow-table-wrap">
                <table className="workflow-table">
                  <caption className="visually-hidden">Danh sách túi máu đã thu nhận</caption>
                  <thead>
                    <tr>
                      <th scope="col">Mã túi</th>
                      <th scope="col">Người hiến</th>
                      <th scope="col">Nhóm máu & Thể tích</th>
                      <th scope="col">Trạng thái</th>
                      <th scope="col" style={{ textAlign: 'right' }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedCollectedBags.map((bag) => (
                      <tr
                        key={bag.id}
                        onClick={() => setViewingBag(bag)}
                        title="Bấm để xem hồ sơ chi tiết túi máu"
                      >
                        <th scope="row">
                          <button
                            type="button"
                            className="btn-link-detail"
                            onClick={(e) => {
                              e.stopPropagation();
                              setViewingBag(bag);
                            }}
                          >
                            <strong>{bag.code}</strong>
                          </button>
                        </th>
                        <td>{bag.donorName}</td>
                        <td>
                          <span className="tag-blood-group" style={{ marginRight: '6px' }}>
                            {formatBloodTypeDisplay(bag.bloodType, bag.bloodGroup)}
                          </span>
                          <span style={{ fontWeight: 600 }}>{bag.volumeMl} ml</span>
                        </td>
                        <td>
                          <StatusPill tone={bagTone[bag.status]}>
                            {BLOOD_BAG_STATUS_LABELS[bag.status]}
                          </StatusPill>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className="btn btn--primary btn--sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setViewingBag(bag);
                            }}
                          >
                            Chi tiết
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            <WorkflowPagination
              page={safeCollectedPage}
              totalPages={collectedTotalPages}
              total={filteredBags.length}
              pageSize={PAGE_SIZE}
              onChange={setCollectedPage}
              itemLabel="túi máu"
            />
          </>
        )}
        </section>
      )}

      {/* Modals */}
      {viewingBag && (
        <BloodBagDetailModal
          bag={viewingBag}
          onClose={() => setViewingBag(null)}
          onEdit={(b) => setEditingBag(b)}
          onDelete={(b) => setDeletingBag(b)}
        />
      )}

      {collectingItem && (
        <QuickCollectModal
          item={collectingItem}
          campaignId={campaignId}
          campaignName={campaignQuery.data?.name}
          onClose={() => setCollectingItem(null)}
          onCollected={() => {
            setCollectingItem(null);
            readyQueue.retry();
            bags.retry();
          }}
        />
      )}

      {editingBag && (
        <EditBloodBagModal
          bag={editingBag}
          onClose={() => setEditingBag(null)}
          onSaved={() => {
            setEditingBag(null);
            bags.retry();
          }}
        />
      )}

      {deletingBag && (
        <ConfirmDialog
          title="Xác nhận xóa túi máu"
          label="Xác nhận xóa"
          pending={isDeleting}
          error={deleteError}
          onCancel={() => {
            setDeletingBag(null);
            setDeleteError(null);
          }}
          onConfirm={handleConfirmDelete}
        >
          <p>
            Bạn có chắc chắn muốn xóa túi máu <strong>{deletingBag.code}</strong> (Người hiến: <strong>{deletingBag.donorName}</strong>) khỏi hệ thống không?
          </p>
        </ConfirmDialog>
      )}
    </WorkflowShell>
  );
}

export function NewBloodBagPage() {
  const { campaignId } = useParams<{ campaignId?: string }>();
  const workflow = useWorkflowRepository();
  const campaignRepo = useCampaignRepository();
  const navigate = useNavigate();
  const mutation = useWorkflowMutation();

  const campaignQuery = useCampaignQuery(
    `blood-bag-campaign:${campaignId}`,
    () => campaignRepo.detail(campaignId!),
    Boolean(campaignId),
  );

  const campaignRegistrations = useWorkflowQuery(
    `campaign-registrations:${campaignId ?? 'all'}`,
    () => workflow.findRegistrations({ campaignId }),
    Boolean(campaignId),
  );

  const [code, setCode] = useState('');
  const [selectedRegistrationId, setSelectedRegistrationId] = useState('');
  const [customDonorName, setCustomDonorName] = useState('');
  const [volume, setVolume] = useState('350');
  const [bloodGroup, setBloodGroup] = useState<string>('');
  const [rh, setRh] = useState<'POSITIVE' | 'NEGATIVE' | ''>('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [created, setCreated] = useState<BloodBag | null>(null);

  const backUrl = campaignId ? `/campaigns/${campaignId}/blood-bags` : '/clinic/blood-bags';
  const backLabel = campaignId ? 'Danh sách túi máu đợt này' : 'Danh sách túi máu';

  function handleSelectDonor(regId: string) {
    setSelectedRegistrationId(regId);
    if (!regId) return;
    const found = (campaignRegistrations.data ?? []).find((r) => r.id === regId);
    if (found) {
      setCustomDonorName(found.donorName);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const nextErrors: FieldErrors = {};
    if (!code.trim()) {
      nextErrors.code = 'Nhập mã túi máu từ 1 đến 50 ký tự.';
    }
    const volNum = Number(volume);
    if (!Number.isInteger(volNum) || volNum <= 0) {
      nextErrors.volumeMl = 'Thể tích phải là số nguyên lớn hơn 0 (ml).';
    }
    const donorName = customDonorName.trim();
    if (!selectedRegistrationId && !donorName) {
      nextErrors.donorName = 'Vui lòng chọn người hiến hoặc nhập họ tên.';
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const input = {
      code: code.trim(),
      volumeMl: volNum,
      bloodGroup: bloodGroup || null,
      bloodType: toBackendBloodType(bloodGroup, rh),
      registrationId: selectedRegistrationId || undefined,
      donorName,
      campaignId,
      campaignName: campaignQuery.data?.name,
      status: 'COLLECTED' as BloodBagStatus,
      notes: notes.trim() || undefined,
    };

    void mutation.run(
      () => workflow.createBloodBag(input),
      (bag) => {
        setCreated(bag);
      },
      'Đã ghi nhận thông tin túi máu thành công.',
    );
  }

  if (created) {
    return (
      <WorkflowShell
        title="Đã lưu túi máu thành công"
        contextBadge={
          campaignQuery.data ? (
            <span className="workflow-context-badge">
              Đợt: {campaignQuery.data.name}
            </span>
          ) : undefined
        }
        back={backUrl}
        backLabel={backLabel}
      >
        <section className="workflow-card">
          <DetailList
            items={[
              { label: 'Mã túi máu', value: created.code },
              { label: 'Người hiến', value: created.donorName || '—' },
              { label: 'Đợt hiến', value: created.campaignName || campaignQuery.data?.name || '—' },
              { label: 'Thể tích', value: `${created.volumeMl} ml` },
              {
                label: 'Nhóm máu & Rh',
                value: created.bloodGroup
                  ? `${created.bloodGroup}${created.bloodType ? ` (${created.bloodType})` : ''}`
                  : 'Chưa rõ (Chờ xét nghiệm)',
              },
              {
                label: 'Trạng thái',
                value: BLOOD_BAG_STATUS_LABELS[created.status],
              },
              ...(created.notes ? [{ label: 'Ghi chú', value: created.notes }] : []),
            ]}
          />

          <div className="workflow-actions" style={{ marginTop: '20px' }}>
            <Button variant="secondary" onClick={() => navigate(backUrl)}>
              {backLabel}
            </Button>
            <Button
              onClick={() => {
                setCreated(null);
                setCode('');
                setSelectedRegistrationId('');
                setCustomDonorName('');
                setVolume('350');
                setBloodGroup('');
                setRh('');
                setNotes('');
                setErrors({});
              }}
            >
              Thêm túi máu khác
            </Button>
          </div>
        </section>
      </WorkflowShell>
    );
  }

  return (
    <WorkflowShell
      title="Thêm túi máu"
      contextBadge={
        campaignQuery.data ? (
          <span className="workflow-context-badge">
            Đợt: {campaignQuery.data.name}
          </span>
        ) : undefined
      }
      back={backUrl}
      backLabel={backLabel}
    >
      <section className="workflow-card" aria-labelledby="new-bag-heading">
        <h2 id="new-bag-heading" style={{ fontSize: '1.1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '12px', marginBottom: '8px' }}>
          Nhập thông tin túi máu thu được
        </h2>

        <form className="workflow-form--inline" onSubmit={submit}>
          <div className="workflow-grid-2col">
            {/* Left Column: Donor & Code */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <FormField
                id="bag-code"
                label="Mã túi máu (Barcode)"
                error={errors.code}
                required
              >
                <Input
                  value={code}
                  placeholder="VD: BAG-00042, BAG-20261010-01..."
                  onChange={(e) => setCode(e.target.value)}
                />
              </FormField>

              {campaignRegistrations.data && campaignRegistrations.data.length > 0 && (
                <FormField
                  id="donor-select"
                  label="Chọn người hiến từ danh sách đăng ký (tùy chọn)"
                >
                  <select
                    className="input"
                    id="donor-select"
                    value={selectedRegistrationId}
                    onChange={(e) => handleSelectDonor(e.target.value)}
                  >
                    <option value="">-- Chọn từ người đăng ký --</option>
                    {campaignRegistrations.data.map((reg) => (
                      <option key={reg.id} value={reg.id}>
                        {reg.donorName} ({reg.code})
                      </option>
                    ))}
                  </select>
                </FormField>
              )}

              <FormField
                id="donor-name"
                label="Họ tên người hiến"
                error={errors.donorName}
                required
              >
                <Input
                  value={customDonorName}
                  placeholder="Nhập họ và tên người hiến"
                  onChange={(e) => {
                    setCustomDonorName(e.target.value);
                    setSelectedRegistrationId('');
                  }}
                />
              </FormField>
            </div>

            {/* Right Column: Collection specs & Blood type */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <FormField
                id="bag-volume"
                label="Thể tích thu nhận (ml)"
                error={errors.volumeMl}
                required
              >
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <Input
                    type="number"
                    min="1"
                    inputMode="numeric"
                    value={volume}
                    onChange={(e) => setVolume(e.target.value)}
                    style={{ maxWidth: '120px' }}
                  />
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {(['250', '350', '450'] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        className={`btn btn--sm ${volume === v ? 'btn--primary' : 'btn--secondary'}`}
                        onClick={() => setVolume(v)}
                      >
                        {v} ml
                      </button>
                    ))}
                  </div>
                </div>
              </FormField>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                <FormField id="blood-group" label="Nhóm máu (ABO)">
                  <select
                    className="input"
                    id="blood-group"
                    value={bloodGroup}
                    onChange={(e) => setBloodGroup(e.target.value)}
                  >
                    <option value="">-- Chưa rõ / Chưa xác định --</option>
                    <option value="A">Nhóm A</option>
                    <option value="B">Nhóm B</option>
                    <option value="AB">Nhóm AB</option>
                    <option value="O">Nhóm O</option>
                  </select>
                </FormField>

                <FormField id="blood-rh" label="Yếu tố Rh">
                  <select
                    className="input"
                    id="blood-rh"
                    value={rh}
                    onChange={(e) => setRh(e.target.value as 'POSITIVE' | 'NEGATIVE' | '')}
                  >
                    <option value="">-- Chưa rõ / Chưa xác định --</option>
                    <option value="POSITIVE">Rh Dương (+)</option>
                    <option value="NEGATIVE">Rh Âm (−)</option>
                  </select>
                </FormField>
              </div>

              <FormField id="bag-notes" label="Ghi chú (tùy chọn)">
                <Input
                  value={notes}
                  placeholder="VD: Thu nhận thuận lợi, bảo quản nhiệt độ chuẩn..."
                  onChange={(e) => setNotes(e.target.value)}
                />
              </FormField>
            </div>
          </div>

          <Feedback error={mutation.error} />

          <div className="workflow-actions" style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <Button
              type="button"
              variant="secondary"
              disabled={mutation.pending}
              onClick={() => navigate(backUrl)}
            >
              Hủy
            </Button>
            <Button type="submit" isLoading={mutation.pending}>
              Lưu túi máu
            </Button>
          </div>
        </form>
      </section>
    </WorkflowShell>
  );
}
